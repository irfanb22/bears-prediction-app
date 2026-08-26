import { supabase } from './supabase';
import type { EmailBlock, EmailComposerDraft } from './emailComposer';

/**
 * Data layer for lifecycle ("automation") emails.
 *
 * Kept out of the components so no view needs to know RPC parameter names, and
 * so the difference between the two similarly-named recipient functions stays in
 * one place: `get_lifecycle_sent_recipients` lists who already received an
 * automation, while `get_lifecycle_recipients` (server-only) answers who is
 * currently eligible.
 */

export interface LifecycleConfig {
  email_type: string;
  name: string;
  description: string | null;
  enabled: boolean;
  delay_hours: number;
  audience: 'all' | 'no_predictions';
  starts_at: string;
  subject: string;
  preview_text: string | null;
  blocks: EmailBlock[];
  header_eyebrow: string;
  header_title: string;
  header_meta: string;
  footer_link_label: string;
  footer_link_href: string;
  stats_campaign_id: string;
  sent_count: number;
}

export interface LifecycleRecipient {
  email: string;
  email_type: string;
  sent_at: string;
  signed_up_at: string;
}

export const AUDIENCE_LABELS: Record<LifecycleConfig['audience'], string> = {
  all: 'Everyone who signs up',
  no_predictions: 'Only people who have not made a prediction',
};

export async function fetchLifecycleConfigs(): Promise<LifecycleConfig[]> {
  const { data, error } = await supabase.rpc('get_lifecycle_configs');
  if (error) throw error;
  return (data ?? []).map((row: LifecycleConfig) => ({
    ...row,
    blocks: Array.isArray(row.blocks) ? row.blocks : [],
    sent_count: Number(row.sent_count ?? 0),
  }));
}

/**
 * Saves content and timing. Deliberately cannot write `starts_at` or
 * `stats_campaign_id` — the RPC does not accept them, which is what stops a
 * client from moving the guard that keeps an automation off the existing list.
 */
export async function updateLifecycleConfig(config: {
  emailType: string;
  subject: string;
  previewText: string | null;
  delayHours: number;
  headerEyebrow: string;
  headerTitle: string;
  headerMeta: string;
  footerLinkLabel: string;
  footerLinkHref: string;
  blocks: EmailBlock[];
}): Promise<void> {
  const { error } = await supabase.rpc('update_lifecycle_config', {
    p_email_type: config.emailType,
    p_subject: config.subject,
    p_preview_text: config.previewText,
    p_delay_hours: config.delayHours,
    p_audience: null,
    p_header_eyebrow: config.headerEyebrow,
    p_header_title: config.headerTitle,
    p_header_meta: config.headerMeta,
    p_footer_link_label: config.footerLinkLabel,
    p_footer_link_href: config.footerLinkHref,
    p_blocks: config.blocks,
  });
  if (error) throw error;
}

/**
 * Switching on is separate from editing because it is the only action here with
 * an outward consequence. The server refuses an empty automation and returns
 * text worth showing, so the caller should surface `error.message` verbatim.
 */
export async function setLifecycleEnabled(emailType: string, enabled: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_lifecycle_enabled', {
    p_email_type: emailType,
    p_enabled: enabled,
  });
  if (error) throw error;
}

export async function fetchLifecycleSentRecipients(
  emailType?: string
): Promise<LifecycleRecipient[]> {
  const { data, error } = await supabase.rpc('get_lifecycle_sent_recipients', {
    p_email_type: emailType ?? null,
    p_limit: 200,
  });
  if (error) throw error;
  return (data ?? []) as LifecycleRecipient[];
}

/**
 * Who would receive this automation on the next run, without sending anything.
 *
 * The edge function already supports this; it writes no ledger rows and sends no
 * mail. Note it returns nothing unless the automation is switched on, because
 * eligibility itself is gated on `enabled`.
 */
export async function previewLifecycleRecipients(
  emailType: string
): Promise<{ wouldSend: number; recipients: string[] }> {
  const { data, error } = await supabase.functions.invoke('run-lifecycle', {
    body: { dryRun: true, emailType },
  });
  if (error) throw error;

  const result = (data as { automations?: Array<{ wouldSend?: number; recipients?: string[] }> })
    ?.automations?.[0];
  return { wouldSend: result?.wouldSend ?? 0, recipients: result?.recipients ?? [] };
}

/** The config's own copy, in the shape the shared preview shell expects. */
export function configToDraft(config: LifecycleConfig): EmailComposerDraft {
  return {
    subject: config.subject,
    previewText: config.preview_text ?? '',
    headerEyebrow: config.header_eyebrow,
    headerTitle: config.header_title,
    headerMeta: config.header_meta,
    footerLinkLabel: config.footer_link_label,
    footerLinkHref: config.footer_link_href,
    blocks: config.blocks,
  };
}
