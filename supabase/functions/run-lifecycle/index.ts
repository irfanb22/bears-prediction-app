// Sends lifecycle (onboarding) emails to individual users as they become
// eligible. Runs on a schedule; each tick handles a small batch per automation.
//
// Unlike a campaign, there's no admin watching — so the safety rules are
// enforced here rather than relying on the UI:
//
//   - an automation with empty content cannot send, even if enabled. Toggling
//     something on before writing the copy should do nothing, not mail blanks.
//   - the ledger row is written *before* the send. A crash mid-batch then means
//     someone misses a welcome, which is recoverable; the alternative ordering
//     means sending it twice, which is not.
//   - `dry_run` reports who would receive a message without sending or
//     recording anything.

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildSeasonRecapEmail,
  type EmailBlock,
} from "../_shared/seasonRecapEmail.ts";
import { buildUnsubscribeUrl, createUnsubscribeToken } from "../_shared/unsubscribe.ts";
import { createSesMailer } from "../_shared/ses.ts";

const BATCH_SIZE = 25;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Same two callers as the campaign dispatcher: the scheduler, or the admin. */
async function requireAuthorizedCaller(req: Request) {
  const dispatchToken = Deno.env.get("DISPATCH_TOKEN");
  const providedToken = new URL(req.url).searchParams.get("token");
  if (dispatchToken && providedToken && providedToken === dispatchToken) {
    return "cron";
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Missing bearer token.");
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) return "cron";

  const {
    data: { user },
    error,
  } = await getAdminClient().auth.getUser(token);

  if (error || !user?.email) throw new Error("Unable to verify caller identity.");
  if (user.email.trim().toLowerCase() !== "irfanbhanji@gmail.com") {
    throw new Error("Admin access required.");
  }
  return "admin";
}

interface LifecycleConfig {
  email_type: string;
  name: string;
  enabled: boolean;
  subject: string;
  preview_text: string | null;
  blocks: EmailBlock[];
  header_eyebrow: string;
  header_title: string;
  header_meta: string;
  footer_link_label: string;
  footer_link_href: string;
  stats_campaign_id: string;
}

/**
 * The shared template requires a full link set and renders its header
 * unconditionally, defaulting to the 2025 season-recap copy. Lifecycle emails
 * therefore supply both explicitly — otherwise a welcome message would arrive
 * headed "2025 Season Recap".
 *
 * Attribution is per-automation, so a signup driven by the welcome email is
 * distinguishable from one driven by a campaign.
 */
function buildLinks(emailType: string) {
  const attribution = `utm_source=email&utm_medium=email&utm_campaign=lifecycle_${emailType}`;
  const withQuery = (url: string) =>
    `${url}${url.includes("?") ? "&" : "?"}${attribution}`;

  return {
    dashboard: withQuery("https://bearsprediction.com/dashboard"),
    recap: withQuery("https://bearsprediction.com/season-recap"),
    leaderboard: withQuery("https://bearsprediction.com/leaderboard"),
    draftQuestion: withQuery("https://bearsprediction.com/"),
  };
}

interface Recipient {
  user_id: string;
  email: string;
}

async function runAutomation(
  supabase: ReturnType<typeof getAdminClient>,
  config: LifecycleConfig,
  dryRun: boolean,
) {
  // The content guard. An automation is only "ready" once someone has actually
  // written it — enabled alone is not enough.
  const blocks = Array.isArray(config.blocks) ? config.blocks : [];
  if (!config.subject.trim() || blocks.length === 0) {
    return {
      emailType: config.email_type,
      skipped: "no content — write the subject and body before enabling",
      sent: 0,
    };
  }

  const { data, error } = await supabase.rpc("get_lifecycle_recipients", {
    p_email_type: config.email_type,
    p_limit: BATCH_SIZE,
  });

  if (error) throw new Error(`Eligibility lookup failed: ${error.message}`);

  const recipients = (data ?? []) as Recipient[];

  if (dryRun) {
    return {
      emailType: config.email_type,
      dryRun: true,
      wouldSend: recipients.length,
      recipients: recipients.map((r) => r.email),
      sent: 0,
    };
  }

  if (recipients.length === 0) {
    return { emailType: config.email_type, sent: 0, failed: 0 };
  }

  const unsubscribeBaseUrl =
    Deno.env.get("EMAIL_UNSUBSCRIBE_URL") ??
    `https://${Deno.env.get("SUPABASE_PROJECT_ID") ?? "mvyvfvwguwqowytnkvvs"}.supabase.co/functions/v1/unsubscribe-email`;
  const unsubscribeSecret = Deno.env.get("UNSUBSCRIBE_SIGNING_SECRET");

  let sent = 0;
  let failed = 0;
  const mailer = createSesMailer();

  try {
    for (const recipient of recipients) {
      // Claim first. If two ticks overlap, the primary key on
      // (user_id, email_type) makes the second insert fail and that recipient
      // is skipped rather than mailed twice.
      const { error: claimError } = await supabase
        .from("lifecycle_emails")
        .insert({ user_id: recipient.user_id, email_type: config.email_type });

      if (claimError) {
        console.log(`Already claimed for ${recipient.email}, skipping`);
        continue;
      }

      try {
        let unsubscribeUrl: string | undefined;
        if (unsubscribeSecret) {
          const token = await createUnsubscribeToken(
            { userId: recipient.user_id, email: recipient.email },
            unsubscribeSecret,
          );
          unsubscribeUrl = buildUnsubscribeUrl(unsubscribeBaseUrl, token);
        }

        const htmlContent = buildSeasonRecapEmail({
          previewText: config.preview_text ?? "",
          links: buildLinks(config.email_type),
          unsubscribeUrl,
          headerEyebrow: config.header_eyebrow,
          headerTitle: config.header_title,
          headerMeta: config.header_meta,
          footerLinkLabel: config.footer_link_label,
          footerLinkHref: config.footer_link_href,
          blocks,
        });

        await mailer.send({
          to: recipient.email,
          subject: config.subject,
          htmlContent,
          // The automation's anchor row, so opens and clicks land in the same
          // stats pipeline campaigns use.
          campaignId: config.stats_campaign_id,
          userId: recipient.user_id,
        });
        sent += 1;
      } catch (sendError) {
        // Release the claim so the next tick retries. Without this a transient
        // SMTP blip would permanently deny someone their welcome email.
        await supabase
          .from("lifecycle_emails")
          .delete()
          .eq("user_id", recipient.user_id)
          .eq("email_type", config.email_type);

        console.error(
          `Lifecycle send failed for ${recipient.email}:`,
          sendError instanceof Error ? sendError.message : sendError,
        );
        failed += 1;
      }
    }
  } finally {
    await mailer.close();
  }

  return { emailType: config.email_type, sent, failed };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    await requireAuthorizedCaller(req);

    let dryRun = false;
    let onlyType: string | null = null;
    try {
      const body = await req.json();
      dryRun = body?.dryRun === true;
      onlyType = body?.emailType ?? null;
    } catch {
      // No body: a normal scheduled tick over every enabled automation.
    }

    const supabase = getAdminClient();

    let query = supabase
      .from("lifecycle_email_configs")
      .select(
        "email_type, name, enabled, subject, preview_text, blocks, stats_campaign_id, " +
          "header_eyebrow, header_title, header_meta, footer_link_label, footer_link_href",
      )
      .eq("enabled", true);

    if (onlyType) query = query.eq("email_type", onlyType);

    const { data: configs, error } = await query;
    if (error) throw new Error(`Failed to load automations: ${error.message}`);

    const results = [];
    for (const config of (configs ?? []) as LifecycleConfig[]) {
      results.push(await runAutomation(supabase, config, dryRun));
    }

    return jsonResponse({ ok: true, dryRun, automations: results });
  } catch (error) {
    console.error("Lifecycle run failed", error);
    return jsonResponse(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});
