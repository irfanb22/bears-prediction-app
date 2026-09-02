/** Shared types for the admin email console. Extracted from AdminEmailDashboard. */

export interface AudienceCounts {
  subscribed_total: number;
  subscribed_with_predictions: number;
  unsubscribed_total: number;
  production_segment_count: number;
}

export interface EmailSendLog {
  id: string;
  created_at: string;
  mode: 'test' | 'send';
  segment: string | null;
  test_email: string | null;
  subject: string;
  recipient_count: number;
  status: 'started' | 'queued' | 'sending' | 'succeeded' | 'failed';
  error_message: string | null;
  payload_snapshot?: unknown;
}

export interface SendMarketingEmailResponse {
  ok?: boolean;
  error?: string;
  recipientCount?: number;
  /** Production sends are queued and drained in batches; tests send inline. */
  queued?: boolean;
  campaignId?: string;
}

export interface ActiveCampaign {
  id: string;
  total: number;
  sent: number;
  failed: number;
  pending: number;
}

/**
 * Per-campaign engagement, from `get_email_campaign_stats()`.
 *
 * Every count is DISTINCT by recipient. SES fires an open event each time the
 * tracking pixel loads — Gmail's image proxy alone produces a second one — so
 * raw event counts overstate reach badly on small sends.
 *
 * Production sends only; test sends are excluded so they can't skew a campaign's
 * numbers.
 *
 * `sent_count` / `failed_count` come from the dispatch ledger and mean something
 * different from `delivered`: they record what SES accepted at the API, whereas
 * `delivered` counts delivery webhooks. An accepted message can still bounce, or
 * be silently discarded by the account suppression list.
 */
export interface CampaignStats {
  campaign_id: string;
  subject: string;
  sent_at: string;
  recipient_count: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  kind: 'campaign' | 'lifecycle';
  sent_count: number;
  failed_count: number;
}

export interface LinkClicks {
  url: string;
  clickers: number;
}

export type Notice = { tone: 'success' | 'error'; message: string } | null;

export const FIXED_SEGMENT = 'all_subscribed_users';
export const DRAFT_STORAGE_KEY = 'admin_email_draft_v1';
