// AWS SES SMTP transport for campaign and lifecycle sends. SES has no API-key
// HTTP endpoint (its API needs SigV4 request signing), so SMTP is the
// low-ceremony path and it reuses the same credential model as q2Kindle.
//
// Port 465 with implicit TLS rather than 587/STARTTLS: denomailer negotiates
// STARTTLS inconsistently, and SES serves both. 465 removes the ambiguity.
//
// Credentials are SES *SMTP* credentials (SES console → SMTP settings → Create
// SMTP credentials), NOT a raw AWS access key. The password is shown once at
// creation — save it to a password manager immediately.

import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const SES_SMTP_PORT = 465;

export interface SesMailer {
  send(args: {
    to: string;
    subject: string;
    htmlContent: string;
    /** `email_send_logs.id` — becomes the SES `campaign_id` message tag. */
    campaignId?: string;
    /** Lets a complaint event unsubscribe the right account with no email lookup. */
    userId?: string;
  }): Promise<void>;
  close(): Promise<void>;
}

/**
 * Opens one SMTP connection for a whole campaign run.
 *
 * Reused across recipients on purpose: SES caps us at 14 sends/sec and a fresh
 * TLS handshake per recipient would both blow that budget and dominate runtime
 * on a list of any size.
 */
export function createSesMailer(): SesMailer {
  const username = Deno.env.get("SES_SMTP_USER");
  const password = Deno.env.get("SES_SMTP_PASSWORD");
  const senderEmail = Deno.env.get("SES_SENDER_EMAIL");
  const senderName = Deno.env.get("SES_SENDER_NAME") ?? "Bears Prediction Tracker";
  const replyToEmail = Deno.env.get("SES_REPLY_TO_EMAIL");
  const region = Deno.env.get("SES_REGION") ?? "us-east-1";
  const configSet = Deno.env.get("SES_CONFIG_SET");

  if (!username || !password) {
    throw new Error("Missing SES_SMTP_USER or SES_SMTP_PASSWORD secrets.");
  }
  if (!senderEmail) {
    throw new Error("Missing SES_SENDER_EMAIL secret.");
  }

  let client: SMTPClient | null = null;

  function getClient(): SMTPClient {
    if (!client) {
      client = new SMTPClient({
        connection: {
          hostname: `email-smtp.${region}.amazonaws.com`,
          port: SES_SMTP_PORT,
          tls: true,
          auth: { username, password },
        },
      });
    }
    return client;
  }

  return {
    async send({ to, subject, htmlContent, campaignId, userId }) {
      // Stamping the configuration set is what makes SES emit delivery/bounce/
      // complaint events for this send. Without it SES still delivers, but the
      // send is invisible in per-product reputation metrics — which is the whole
      // reason Bears has its own config set separate from q2Kindle's.
      const headers: Record<string, string> = {};
      if (configSet) headers["X-SES-CONFIGURATION-SET"] = configSet;

      // Message tags ride along on every event SES emits for this message, so
      // the webhook can attribute an open or a bounce back to a campaign and an
      // account without maintaining its own message-id join table.
      //
      // SES only accepts [A-Za-z0-9_-] in tag values. UUIDs qualify; anything
      // that doesn't is dropped rather than risking a rejected send.
      const tags: string[] = [];
      const isTagSafe = (v: string) => /^[A-Za-z0-9_-]+$/.test(v);
      if (campaignId && isTagSafe(campaignId)) tags.push(`campaign_id=${campaignId}`);
      if (userId && isTagSafe(userId)) tags.push(`user_id=${userId}`);
      if (tags.length) headers["X-SES-MESSAGE-TAGS"] = tags.join(",");

      // Work around a double-encoding bug in denomailer 1.6.0's
      // quotedPrintableEncode: it rewrites " \n" to the literal string "=20\n"
      // and then the per-character pass re-encodes that "=" as "=3D", so the
      // wire format is "=3D20\n". The recipient's client decodes "=3D" back to
      // "=" and renders a visible "=20" in the body. Any line of HTML ending in
      // a space triggers it, which generated templates do constantly.
      //
      // Stripping trailing horizontal whitespace avoids the only code path that
      // pre-inserts an escape sequence, and is a no-op for HTML rendering.
      const safeHtml = htmlContent.replace(/[ \t]+(\r?\n)/g, "$1");

      try {
        await getClient().send({
          from: `${senderName} <${senderEmail}>`,
          to,
          replyTo: replyToEmail ? `${senderName} <${replyToEmail}>` : undefined,
          subject,
          html: safeHtml,
          headers,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`SES send failed for ${to}: ${message}`);
      }
    },

    async close() {
      if (client) {
        await client.close();
        client = null;
      }
    },
  };
}
