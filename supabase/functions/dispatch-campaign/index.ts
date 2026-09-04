// Drains a queued campaign one batch at a time.
//
// Why batches: the edge runtime allows roughly 2 seconds of CPU per invocation,
// and MIME-encoding a 50KB message costs ~18ms of it. A few hundred recipients
// in one request blows that budget and the send dies partway through — some
// people mailed, some not, and no clean way to resume.
//
// Invoked two ways, both safe to overlap:
//   - the admin UI, right after enqueueing and then on each poll
//   - pg_cron, so a closed browser can't strand a campaign
//
// `claim_campaign_recipients` uses FOR UPDATE SKIP LOCKED, so concurrent callers
// take different rows rather than double-sending to the same person.

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

// 25 × ~18ms of encoding leaves the CPU budget about three-quarters unused,
// which is the headroom that keeps template rendering and JSON parsing from
// pushing an invocation over the edge.
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

/**
 * Two callers are legitimate: the admin in the browser, and the cron job.
 *
 * Platform JWT verification alone isn't enough here — it proves the caller is
 * *some* signed-in user, and dispatching sends real email. So the admin path
 * checks identity, and the cron path presents the service-role key.
 */
async function requireAuthorizedCaller(req: Request) {
  // Cron path. Deliberately a narrow, single-purpose token rather than the
  // service-role key: the job's SQL is readable by anyone with database access,
  // and this secret should only be able to drain a queue that was already
  // approved for sending — not read or write arbitrary tables.
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
  if (!token) {
    throw new Error("Missing bearer token.");
  }

  if (token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
    return "cron";
  }

  const {
    data: { user },
    error,
  } = await getAdminClient().auth.getUser(token);

  if (error || !user?.email) {
    throw new Error("Unable to verify caller identity.");
  }

  if (user.email.trim().toLowerCase() !== "irfanbhanji@gmail.com") {
    throw new Error("Admin access required.");
  }

  return "admin";
}

interface ClaimedRecipient {
  id: string;
  email: string;
  user_id: string | null;
}

/** Sends one batch for a campaign. Returns how much work is left. */
async function dispatchCampaign(supabase: ReturnType<typeof getAdminClient>, campaignId: string) {
  const { data: log, error: logError } = await supabase
    .from("email_send_logs")
    .select("id, subject, status, payload_snapshot")
    .eq("id", campaignId)
    .single();

  if (logError || !log) {
    throw new Error(`Campaign ${campaignId} not found: ${logError?.message ?? "no row"}`);
  }

  if (!["queued", "sending"].includes(log.status)) {
    return { claimed: 0, sent: 0, failed: 0, remaining: 0, status: log.status };
  }

  const { data: claimed, error: claimError } = await supabase.rpc("claim_campaign_recipients", {
    p_campaign_id: campaignId,
    p_limit: BATCH_SIZE,
  });

  if (claimError) {
    throw new Error(`Failed to claim recipients: ${claimError.message}`);
  }

  const batch = (claimed ?? []) as ClaimedRecipient[];

  if (batch.length > 0) {
    await supabase.from("email_send_logs").update({ status: "sending" }).eq("id", campaignId);
  }

  const payload = (log.payload_snapshot ?? {}) as Record<string, any>;
  const previewText =
    typeof payload.previewText === "string"
      ? payload.previewText
      : "The dust has settled. See how Bears fans did across all 13 predictions and check your results.";
  const links = resolveSeasonRecapLinks(payload.links as Partial<SeasonRecapLinks> | undefined);
  const imageUrls = resolveSeasonRecapImageUrls(
    payload.imageUrls as SeasonRecapImageUrls | undefined,
  );
  const unsubscribeBaseUrl =
    Deno.env.get("EMAIL_UNSUBSCRIBE_URL") ??
    `https://${Deno.env.get("SUPABASE_PROJECT_ID") ?? "mvyvfvwguwqowytnkvvs"}.supabase.co/functions/v1/unsubscribe-email`;
  const unsubscribeSecret = Deno.env.get("UNSUBSCRIBE_SIGNING_SECRET");

  let sent = 0;
  let failed = 0;

  if (batch.length > 0) {
    const mailer = createSesMailer();
    try {
      for (const recipient of batch) {
        try {
          let unsubscribeUrl: string | undefined;
          if (unsubscribeSecret && recipient.user_id) {
            const token = await createUnsubscribeToken(
              { userId: recipient.user_id, email: recipient.email },
              unsubscribeSecret,
            );
            unsubscribeUrl = buildUnsubscribeUrl(unsubscribeBaseUrl, token);
          }

          const htmlContent = buildSeasonRecapEmail({
            previewText,
            imageUrls,
            links,
            unsubscribeUrl,
            headerEyebrow: payload.headerEyebrow,
            headerTitle: payload.headerTitle,
            headerMeta: payload.headerMeta,
            footerLinkLabel: payload.footerLinkLabel,
            footerLinkHref: payload.footerLinkHref,
            blocks: payload.blocks as EmailBlock[],
          });

          await mailer.send({
            to: recipient.email,
            subject: log.subject,
            htmlContent,
            campaignId,
            userId: recipient.user_id ?? undefined,
          });

          await supabase
            .from("email_campaign_recipients")
            .update({ status: "sent", sent_at: new Date().toISOString() })
            .eq("id", recipient.id);
          sent += 1;
        } catch (error) {
          // One bad address must not abandon the rest of the batch — the whole
          // point of the queue is that failures stay isolated to their row.
          const message = error instanceof Error ? error.message : "Unknown error";
          console.error(`Send failed for ${recipient.email}: ${message}`);
          await supabase
            .from("email_campaign_recipients")
            .update({ status: "failed", error_message: message })
            .eq("id", recipient.id);
          failed += 1;
        }
      }
    } finally {
      await mailer.close();
    }
  }

  const { data: progressRows } = await supabase.rpc("get_campaign_progress", {
    p_campaign_id: campaignId,
  });
  const progress = (Array.isArray(progressRows) ? progressRows[0] : progressRows) ?? {};
  const remaining = Number(progress.pending ?? 0);

  if (remaining === 0) {
    const totalSent = Number(progress.sent ?? 0);
    const totalFailed = Number(progress.failed ?? 0);

    // "succeeded" as long as anyone got it. A campaign where 2 of 90 addresses
    // are dead is a successful campaign with two bad rows, not a failure — the
    // per-recipient rows carry the detail.
    await supabase
      .from("email_send_logs")
      .update({
        status: totalSent > 0 ? "succeeded" : "failed",
        recipient_count: totalSent,
        error_message: totalFailed > 0 ? `${totalFailed} recipient(s) failed` : null,
        response_snapshot: { sent: totalSent, failed: totalFailed },
      })
      .eq("id", campaignId);
  }

  return { claimed: batch.length, sent, failed, remaining, status: remaining === 0 ? "done" : "sending" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    await requireAuthorizedCaller(req);

    let campaignId: string | null = null;
    try {
      const body = await req.json();
      campaignId = body?.campaignId ?? null;
    } catch {
      // No body: treat as a cron tick and scan for anything outstanding.
    }

    const supabase = getAdminClient();

    if (campaignId) {
      const result = await dispatchCampaign(supabase, campaignId);
      return jsonResponse({ ok: true, ...result });
    }

    const { data: active, error } = await supabase.rpc("get_active_campaigns");
    if (error) throw new Error(`Failed to scan campaigns: ${error.message}`);

    const results = [];
    for (const row of (active ?? []) as { campaign_id: string }[]) {
      results.push({
        campaignId: row.campaign_id,
        ...(await dispatchCampaign(supabase, row.campaign_id)),
      });
    }

    return jsonResponse({ ok: true, campaigns: results });
  } catch (error) {
    console.error("Dispatch failed", error);
    return jsonResponse(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});
