// Receives SES engagement events (delivery/open/click/bounce/complaint) via an
// SNS topic subscribed to the `bears-marketing` configuration set.
//
// Why this exists: `email_send_logs.status = 'succeeded'` only means SES
// accepted the message. Amazon can still fail to deliver it, and the recipient
// can still mark it as spam — both invisible until now.
//
// Auth: `?token=` must match SES_WEBHOOK_TOKEN. SNS cannot send custom headers,
// so a query-string secret is the available mechanism.

import { createClient } from "npm:@supabase/supabase-js@2";

type SnsEnvelope = {
  Type?: string;
  Message?: string;
  SubscribeURL?: string;
  TopicArn?: string;
};

function getAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY secrets.");
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Confirms an SNS subscription by fetching the URL Amazon supplies.
 *
 * The host check is the important part: without it, anyone who knew the webhook
 * token could hand us an arbitrary URL and make this function issue a GET to it.
 */
async function confirmSubscription(subscribeUrl: string) {
  const url = new URL(subscribeUrl);

  if (url.protocol !== "https:" || !url.hostname.endsWith(".amazonaws.com")) {
    throw new Error(`Refusing to confirm subscription at untrusted host: ${url.hostname}`);
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Subscription confirmation failed: ${response.status}`);
  }
}

/** Pulls the `campaign_id` / `user_id` tags the sender stamped on the message. */
function readTag(tags: Record<string, string[]> | undefined, name: string): string | null {
  const value = tags?.[name]?.[0];
  // SES echoes tags it doesn't recognise as the literal string it received, and
  // reports untagged messages with a placeholder rather than omitting the key.
  if (!value || value === "ses:no-tag" || value === "none") return null;
  return value;
}

/**
 * Flattens an SES event into a row.
 *
 * SES nests the interesting bits differently per event type, so the mapping is
 * explicit rather than clever — each branch reads only what that type carries.
 */
function mapEvent(message: Record<string, any>) {
  const rawType: string = message.eventType ?? message.notificationType ?? "";
  const eventType = rawType.toLowerCase().replace(/[^a-z]/g, "");

  const mail = message.mail ?? {};
  const tags = mail.tags as Record<string, string[]> | undefined;

  let recipient: string | null = mail.destination?.[0] ?? null;
  let detail: string | null = null;
  let occurredAt: string | null = mail.timestamp ?? null;

  if (eventType === "bounce") {
    const bounce = message.bounce ?? {};
    recipient = bounce.bouncedRecipients?.[0]?.emailAddress ?? recipient;
    detail = [bounce.bounceType, bounce.bounceSubType].filter(Boolean).join("/") || null;
    occurredAt = bounce.timestamp ?? occurredAt;
  } else if (eventType === "complaint") {
    const complaint = message.complaint ?? {};
    recipient = complaint.complainedRecipients?.[0]?.emailAddress ?? recipient;
    detail = complaint.complaintFeedbackType ?? null;
    occurredAt = complaint.timestamp ?? occurredAt;
  } else if (eventType === "click") {
    detail = message.click?.link ?? null;
    occurredAt = message.click?.timestamp ?? occurredAt;
  } else if (eventType === "delivery") {
    occurredAt = message.delivery?.timestamp ?? occurredAt;
  } else if (eventType === "open") {
    occurredAt = message.open?.timestamp ?? occurredAt;
  }

  return {
    event_type: eventType,
    campaign_id: readTag(tags, "campaign_id"),
    user_id: readTag(tags, "user_id"),
    recipient,
    ses_message_id: mail.messageId ?? null,
    occurred_at: occurredAt,
    detail,
    payload: message,
  };
}

const KNOWN_EVENT_TYPES = new Set([
  "send", "delivery", "open", "click", "bounce", "complaint",
  "reject", "renderingfailure", "deliverydelay", "subscription",
]);

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const expectedToken = Deno.env.get("SES_WEBHOOK_TOKEN");

    if (!expectedToken) {
      console.error("SES_WEBHOOK_TOKEN is not configured");
      return new Response("Not configured", { status: 500 });
    }

    if (!token || token !== expectedToken) {
      return new Response("Unauthorized", { status: 401 });
    }

    const raw = await req.text();
    let envelope: SnsEnvelope;

    try {
      envelope = JSON.parse(raw);
    } catch {
      return new Response("Bad request", { status: 400 });
    }

    // SNS sends this once when the subscription is created. Confirming it is
    // what flips the subscription to "Confirmed" in the AWS console.
    if (envelope.Type === "SubscriptionConfirmation" && envelope.SubscribeURL) {
      await confirmSubscription(envelope.SubscribeURL);
      console.log("Confirmed SNS subscription for topic", envelope.TopicArn);
      return new Response("Subscription confirmed", { status: 200 });
    }

    if (envelope.Type === "UnsubscribeConfirmation") {
      console.warn("SNS subscription was removed for topic", envelope.TopicArn);
      return new Response("OK", { status: 200 });
    }

    if (!envelope.Message) {
      return new Response("OK", { status: 200 });
    }

    const message = JSON.parse(envelope.Message);
    const row = mapEvent(message);

    if (!KNOWN_EVENT_TYPES.has(row.event_type)) {
      // Returning 200 on purpose: a non-2xx makes SNS retry, and retrying an
      // event type we will never understand just fills the log with noise.
      console.warn("Ignoring unrecognised SES event type", row.event_type);
      return new Response("Ignored", { status: 200 });
    }

    const supabase = getAdminClient();
    const { error: insertError } = await supabase
      .from("email_marketing_events")
      .insert(row);

    if (insertError) {
      throw new Error(`Failed to store SES event: ${insertError.message}`);
    }

    // A complaint is an explicit "stop emailing me" — honouring it immediately
    // is both the right thing to do and what keeps the account's complaint rate
    // under the 0.1% threshold that triggers AWS review.
    if (row.event_type === "complaint" && row.user_id) {
      const { error: unsubError } = await supabase
        .from("email_preferences")
        .upsert({
          user_id: row.user_id,
          marketing_subscribed: false,
          unsubscribed_at: new Date().toISOString(),
        });

      if (unsubError) {
        // Deliberately not fatal: the event is already recorded, and failing the
        // request would make SNS redeliver it and duplicate the row.
        console.error("Failed to auto-unsubscribe complainant", unsubError.message);
      }
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Failed to process SES event", error);
    return new Response("Error", { status: 500 });
  }
});
