import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildSeasonRecapEmail,
  resolveSeasonRecapImageUrls,
  resolveSeasonRecapLinks,
  type EmailBlock,
  type SeasonRecapImageUrls,
  type SeasonRecapLinks,
} from "../_shared/seasonRecapEmail.ts";
import { buildUnsubscribeUrl, createUnsubscribeToken } from "../_shared/unsubscribe.ts";
import { createSesMailer } from "../_shared/ses.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SegmentName = "all_subscribed_users";
type SendMode = "test" | "send";

interface SendMarketingEmailRequest {
  mode?: SendMode;
  segment?: SegmentName;
  recipients?: string[];
  testEmail?: string;
  subject?: string;
  previewText?: string;
  headerEyebrow?: string;
  headerTitle?: string;
  headerMeta?: string;
  footerLinkLabel?: string;
  footerLinkHref?: string;
  imageUrls?: SeasonRecapImageUrls;
  links?: Partial<SeasonRecapLinks>;
  blocks?: EmailBlock[];
}

interface Contact {
  user_id?: string;
  email: string;
}

interface AuthenticatedAdmin {
  id: string;
  email: string;
}

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

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function dedupeEmails(values: string[]) {
  return [...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))];
}

async function requireAdmin(req: Request): Promise<AuthenticatedAdmin> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Missing bearer token.");
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    throw new Error("Missing bearer token.");
  }

  const supabase = getAdminClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user?.email) {
    throw new Error("Unable to verify caller identity.");
  }

  if (user.email.trim().toLowerCase() !== "irfanbhanji@gmail.com") {
    throw new Error("Admin access required.");
  }

  return {
    id: user.id,
    email: user.email.trim().toLowerCase(),
  };
}

async function listAllAuthUsers() {
  const supabase = getAdminClient();
  const users = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw new Error(`Failed to list auth users: ${error.message}`);
    }

    users.push(...data.users);

    if (data.users.length < perPage) {
      break;
    }

    page += 1;
  }

  return users;
}

async function fetchAllSubscribedUsers() {
  const supabase = getAdminClient();

  const users = await listAllAuthUsers();
  // A created auth row is not enough for a marketing send. Requiring email
  // confirmation proves the recipient controls the address and keeps abandoned
  // or mistyped signups out of the campaign audience.
  const emails = users
    .filter((user) => user.email && user.email_confirmed_at)
    .map((user) => ({ user_id: user.id, email: user.email! }));

  const { data: preferences, error: preferencesError } = await supabase
    .from("email_preferences")
    .select("user_id, marketing_subscribed");

  if (preferencesError) {
    throw new Error(`Failed to fetch email preferences: ${preferencesError.message}`);
  }

  const subscriptionMap = new Map(
    (preferences ?? []).map((preference) => [preference.user_id, preference.marketing_subscribed]),
  );

  return emails.filter((contact) => subscriptionMap.get(contact.user_id) !== false);
}

async function findRecipientByEmail(email: string): Promise<Contact> {
  const normalizedEmail = email.trim().toLowerCase();
  const supabase = getAdminClient();
  const users = await listAllAuthUsers();
  const user = users.find((entry) => entry.email?.trim().toLowerCase() === normalizedEmail);

  if (!user) {
    return { email: normalizedEmail };
  }

  const { data: preference, error: preferenceError } = await supabase
    .from("email_preferences")
    .select("marketing_subscribed")
    .eq("user_id", user.id)
    .maybeSingle();

  if (preferenceError) {
    throw new Error(`Failed to look up email preference for test email: ${preferenceError.message}`);
  }

  if (preference?.marketing_subscribed === false) {
    throw new Error("This test recipient is unsubscribed from marketing emails.");
  }

  return {
    user_id: user.id,
    email: normalizedEmail,
  };
}

async function resolveRecipients(request: SendMarketingEmailRequest) {
  if (request.mode === "test") {
    if (!request.testEmail) {
      throw new Error("`testEmail` is required when mode is `test`.");
    }

    return [await findRecipientByEmail(request.testEmail)];
  }

  if (request.recipients?.length) {
    return dedupeEmails(request.recipients).map((email) => ({ email }));
  }

  const segment = request.segment ?? "all_subscribed_users";

  if (segment !== "all_subscribed_users") {
    throw new Error(`Unsupported segment: ${segment}`);
  }

  const contacts = await fetchAllSubscribedUsers();
  const deduped = new Map<string, Contact>();
  for (const contact of contacts) {
    const normalizedEmail = contact.email.trim().toLowerCase();
    if (!deduped.has(normalizedEmail)) {
      deduped.set(normalizedEmail, {
        user_id: contact.user_id,
        email: normalizedEmail,
      });
    }
  }

  return [...deduped.values()];
}

async function createEmailSendLog({
  adminUserId,
  request,
  subject,
  previewText,
  segment,
  imageUrls,
  links,
}: {
  adminUserId: string;
  request: SendMarketingEmailRequest;
  subject: string;
  previewText: string;
  segment: SegmentName;
  imageUrls: SeasonRecapImageUrls;
  links: SeasonRecapLinks;
}) {
  const supabase = getAdminClient();
  const payloadSnapshot = {
    mode: request.mode ?? "send",
    segment,
    recipients: dedupeEmails(request.recipients ?? []),
    testEmail: request.testEmail?.trim().toLowerCase() ?? null,
    subject,
    previewText,
    headerEyebrow: request.headerEyebrow ?? null,
    headerTitle: request.headerTitle ?? null,
    headerMeta: request.headerMeta ?? null,
    footerLinkLabel: request.footerLinkLabel ?? null,
    footerLinkHref: request.footerLinkHref ?? null,
    imageUrls,
    links,
    blocks: request.blocks ?? [],
  };

  const { data, error } = await supabase
    .from("email_send_logs")
    .insert({
      sent_by_user_id: adminUserId,
      mode: request.mode ?? "send",
      segment,
      test_email: request.testEmail?.trim().toLowerCase() ?? null,
      subject,
      recipient_count: 0,
      status: "started",
      payload_snapshot: payloadSnapshot,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to create email send log: ${error.message}`);
  }

  return data.id as string;
}

async function finalizeEmailSendLog({
  logId,
  status,
  recipientCount,
  responseSnapshot,
  errorMessage,
}: {
  logId: string;
  // "queued" is terminal for this request but not for the campaign — the
  // dispatcher moves it on to sending, then succeeded or failed.
  status: "queued" | "succeeded" | "failed";
  recipientCount: number;
  responseSnapshot?: unknown;
  errorMessage?: string;
}) {
  const supabase = getAdminClient();
  const { error } = await supabase
    .from("email_send_logs")
    .update({
      status,
      recipient_count: recipientCount,
      response_snapshot: responseSnapshot ?? null,
      error_message: errorMessage ?? null,
    })
    .eq("id", logId);

  if (error) {
    console.error("Failed to finalize email send log", error);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const admin = await requireAdmin(req);
    const request = (await req.json()) as SendMarketingEmailRequest;

    const subject = request.subject ?? "How Bears fans predicted the 2025 season";
    const previewText =
      request.previewText ??
      "The dust has settled. See how Bears fans did across all 13 predictions and check your results.";

    const links = resolveSeasonRecapLinks(request.links);
    const imageUrls = resolveSeasonRecapImageUrls(request.imageUrls);
    const unsubscribeBaseUrl =
      Deno.env.get("EMAIL_UNSUBSCRIBE_URL") ??
      `https://${Deno.env.get("SUPABASE_PROJECT_ID") ?? "mvyvfvwguwqowytnkvvs"}.supabase.co/functions/v1/unsubscribe-email`;
    const unsubscribeSecret = Deno.env.get("UNSUBSCRIBE_SIGNING_SECRET");
    const segment = request.segment ?? "all_subscribed_users";

    // Render once before creating a production queue. This catches malformed
    // composer data before any recipient row can be claimed or marked failed.
    buildSeasonRecapEmail({
      previewText,
      imageUrls,
      links,
      headerEyebrow: request.headerEyebrow,
      headerTitle: request.headerTitle,
      headerMeta: request.headerMeta,
      footerLinkLabel: request.footerLinkLabel,
      footerLinkHref: request.footerLinkHref,
      blocks: request.blocks,
    });

    const logId = await createEmailSendLog({
      adminUserId: admin.id,
      request,
      subject,
      previewText,
      segment,
      imageUrls,
      links,
    });

    try {
      const recipients = await resolveRecipients(request);

      if (recipients.length === 0) {
        await finalizeEmailSendLog({
          logId,
          status: "failed",
          recipientCount: 0,
          errorMessage: "No recipients resolved for this request.",
        });
        return jsonResponse({ error: "No recipients resolved for this request." }, 400);
      }

      // Production sends are queued rather than sent inline. The edge runtime
      // allows ~2s of CPU per invocation and MIME encoding costs ~18ms per 50KB
      // message, so sending a few hundred recipients in this request would be
      // killed partway through — some people mailed, some not, no way to resume.
      //
      // Test sends stay inline: one recipient, and the admin wants the result
      // immediately rather than watching a progress bar.
      if ((request.mode ?? "send") === "send") {
        const { error: enqueueError } = await getAdminClient()
          .from("email_campaign_recipients")
          .insert(
            recipients.map((recipient) => ({
              campaign_id: logId,
              email: recipient.email,
              user_id: recipient.user_id ?? null,
            })),
          );

        if (enqueueError) {
          throw new Error(`Failed to queue recipients: ${enqueueError.message}`);
        }

        await finalizeEmailSendLog({
          logId,
          status: "queued",
          recipientCount: recipients.length,
        });

        return jsonResponse({
          ok: true,
          mode: "send",
          queued: true,
          campaignId: logId,
          recipientCount: recipients.length,
        });
      }

      const results = [];
      // One SMTP connection for the whole run — see createSesMailer.
      const mailer = createSesMailer();
      try {
        for (const recipient of recipients) {
          let unsubscribeUrl: string | undefined;
          if (unsubscribeSecret && recipient.user_id) {
            const token = await createUnsubscribeToken(
              {
                userId: recipient.user_id,
                email: recipient.email,
              },
              unsubscribeSecret,
            );
            unsubscribeUrl = buildUnsubscribeUrl(unsubscribeBaseUrl, token);
          }

          const htmlContent = buildSeasonRecapEmail({
            previewText,
            imageUrls,
            links,
            unsubscribeUrl,
            headerEyebrow: request.headerEyebrow,
            headerTitle: request.headerTitle,
            headerMeta: request.headerMeta,
            footerLinkLabel: request.footerLinkLabel,
            footerLinkHref: request.footerLinkHref,
            blocks: request.blocks,
          });

          await mailer.send({
            to: recipient.email,
            subject,
            htmlContent,
            campaignId: logId,
            userId: recipient.user_id,
          });

          results.push({
            email: recipient.email,
            result: { accepted: true },
          });
        }
      } finally {
        await mailer.close();
      }

      const responsePayload = {
        ok: true,
        mode: request.mode ?? "send",
        recipientCount: recipients.length,
        recipients: recipients.map((recipient) => recipient.email),
        results,
      };

      await finalizeEmailSendLog({
        logId,
        status: "succeeded",
        recipientCount: recipients.length,
        responseSnapshot: responsePayload,
      });

      return jsonResponse(responsePayload);
    } catch (error) {
      await finalizeEmailSendLog({
        logId,
        status: "failed",
        recipientCount: 0,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});
