import { supabase } from '../../lib/supabase';
import { StatTile } from './StatTile';
import type { CampaignStats, LinkClicks } from './types';

/**
 * One decimal only in the low single digits, where the difference between 2%
 * and 2.4% is worth seeing and rounding would flatten it to noise.
 */
export function pct(num: number, denom: number): string {
  if (!denom) return '—';
  const rate = (num / denom) * 100;
  if (rate > 0 && rate < 10) return `${rate.toFixed(1)}%`;
  return `${Math.round(rate)}%`;
}

/**
 * Distinct clickers per URL for one campaign.
 *
 * Counted by recipient rather than by event: a reader who clicks the same link
 * three times is one interested person, not three.
 */
export async function fetchLinkClicks(campaignId: string): Promise<LinkClicks[]> {
  const { data, error } = await supabase
    .from('email_marketing_events')
    .select('detail, recipient')
    .eq('campaign_id', campaignId)
    .eq('event_type', 'click');

  if (error) throw error;

  const byUrl = new Map<string, Set<string>>();
  for (const row of data ?? []) {
    const url = (row as { detail: string | null }).detail;
    if (!url) continue;
    const who = (row as { recipient: string | null }).recipient ?? 'unknown';
    if (!byUrl.has(url)) byUrl.set(url, new Set());
    byUrl.get(url)!.add(who);
  }

  return [...byUrl.entries()]
    .map(([url, people]) => ({ url, clickers: people.size }))
    .sort((a, b) => b.clickers - a.clickers);
}

/**
 * Engagement for a single campaign or automation.
 *
 * Rates divide by delivered where we have it, falling back to what SES accepted
 * and finally to the queued total. Delivered is the honest denominator — a
 * message that never reached a mail server had no chance of being opened — but
 * delivery webhooks can lag or be missing entirely on older sends.
 */
export function CampaignStatsPanel({
  stats,
  links,
  loadingLinks,
}: {
  stats: CampaignStats;
  links?: LinkClicks[];
  loadingLinks?: boolean;
}) {
  const hasEvents =
    stats.delivered + stats.opened + stats.clicked + stats.bounced + stats.complained > 0;

  if (!hasEvents) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
        No tracking events recorded for this send. Either it went out before tracking was wired up,
        or nobody has opened it yet.
      </p>
    );
  }

  const denom = stats.delivered || stats.sent_count || stats.recipient_count || 0;
  const maxClickers = Math.max(1, ...(links ?? []).map((l) => l.clickers));

  return (
    <div>
      <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
        <StatTile
          label="Delivered"
          term="Delivered"
          value={stats.delivered}
          sub={stats.sent_count ? `of ${stats.sent_count} sent` : undefined}
        />
        <StatTile
          label="Open rate"
          term="Open rate"
          value={pct(stats.opened, denom)}
          sub={`${stats.opened} opens*`}
        />
        <StatTile
          label="Click rate"
          term="Click rate"
          value={pct(stats.clicked, denom)}
          sub={`${stats.clicked} clicks`}
          accent
        />
        <StatTile
          label="Bounced"
          term="Bounced"
          value={stats.bounced}
          sub={
            <span className="inline-flex items-center gap-1">
              {stats.complained} complained
            </span>
          }
          danger={stats.bounced > 0 || stats.complained > 0}
        />
      </div>

      {loadingLinks ? (
        <p className="mt-4 text-xs text-slate-500">Loading link clicks…</p>
      ) : links && links.length > 0 ? (
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-medium text-slate-500">Clicks by link</p>
          <div className="space-y-1">
            {links.map((link) => (
              <div
                key={link.url}
                className="relative overflow-hidden rounded-lg bg-slate-100"
                title={link.url}
              >
                {/* Bars are relative to the busiest link, not the audience — this
                    is about which link won, not what share of readers clicked. */}
                <div
                  className="absolute inset-y-0 left-0 bg-bears-orange/15"
                  style={{ width: `${(link.clickers / maxClickers) * 100}%` }}
                />
                <div className="relative flex items-center justify-between gap-3 px-2.5 py-1.5 text-xs">
                  <span className="truncate text-slate-700">{link.url}</span>
                  <span className="flex-shrink-0 font-bold text-slate-500">{link.clickers}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <p className="mt-3 text-xs italic text-slate-500">
        * Opens are approximate — image proxies and privacy features inflate them. Decide from clicks.
      </p>
    </div>
  );
}
