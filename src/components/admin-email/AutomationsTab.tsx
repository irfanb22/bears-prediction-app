import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  fetchLifecycleConfigs,
  fetchLifecycleSentRecipients,
  type LifecycleConfig,
  type LifecycleRecipient,
} from '../../lib/lifecycleEmails';
import { AutomationCard } from './AutomationCard';
import { RecipientsModal } from './RecipientsModal';
import { StatTile } from './StatTile';
import { pct } from './CampaignStatsPanel';
import type { CampaignStats } from './types';

export function AutomationsTab() {
  const [configs, setConfigs] = useState<LifecycleConfig[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ delivered: number; opened: number; clicked: number } | null>(null);

  const [recipientsOpen, setRecipientsOpen] = useState(false);
  const [recipients, setRecipients] = useState<LifecycleRecipient[] | null>(null);
  const [recipientsLoading, setRecipientsLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setConfigs(await fetchLifecycleConfigs());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load automations');
    }

    // Automations reuse the campaign stats pipeline: each owns an anchor row, so
    // asking for the 'lifecycle' kind returns their engagement with no extra RPC.
    try {
      const { data } = await supabase.rpc('get_email_campaign_stats', { p_kind: 'lifecycle' });
      const rows = (data ?? []) as CampaignStats[];
      setSummary({
        delivered: rows.reduce((sum, row) => sum + Number(row.delivered ?? 0), 0),
        opened: rows.reduce((sum, row) => sum + Number(row.opened ?? 0), 0),
        clicked: rows.reduce((sum, row) => sum + Number(row.clicked ?? 0), 0),
      });
    } catch {
      setSummary(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function openRecipients() {
    setRecipientsOpen(true);
    if (recipients || recipientsLoading) return;
    setRecipientsLoading(true);
    try {
      setRecipients(await fetchLifecycleSentRecipients());
    } catch {
      setRecipients([]);
    } finally {
      setRecipientsLoading(false);
    }
  }

  const totalSent = (configs ?? []).reduce((sum, config) => sum + config.sent_count, 0);
  const readyCount = (configs ?? []).filter((config) => config.enabled).length;

  return (
    <section className="mt-6">
      <h2 className="text-lg font-bold text-bears-navy">Automations</h2>
      <p className="mt-1 max-w-3xl text-xs text-slate-500">
        Emails sent to one person at a time, triggered by where they are in their own timeline
        rather than by a date. Only people who sign up while an automation is on will receive it —
        switching one on never emails your existing list.
      </p>

      {/* The switch says Ready, not Active, because nothing runs these yet. An
          admin who configures one and walks away should not be left believing
          mail is going out. */}
      <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
        <div className="text-sm text-amber-900">
          <p className="font-bold">Scheduling isn't turned on yet</p>
          <p className="mt-1 leading-relaxed text-amber-800">
            Write your automations here and switch them on — but nothing sends automatically yet,
            because the scheduler that runs them hasn't been installed. An automation marked Ready
            is finished and will start sending the moment scheduling is enabled. Nobody is receiving
            these in the meantime.
          </p>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
          {error}
        </p>
      ) : configs === null ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading automations…
        </p>
      ) : (
        <>
          <div className="mt-5 grid gap-2 grid-cols-2 sm:grid-cols-4">
            <StatTile
              label="Ready"
              term="Ready"
              value={`${readyCount} of ${configs.length}`}
              sub={readyCount > 0 ? 'not sending yet' : 'none switched on'}
              accent={readyCount > 0}
            />
            <StatTile
              label="Total sent"
              value={totalSent}
              sub={totalSent > 0 ? 'View recipients →' : 'no sends yet'}
              onClick={totalSent > 0 ? () => void openRecipients() : undefined}
            />
            <StatTile
              label="Open rate"
              term="Open rate"
              value={summary ? pct(summary.opened, summary.delivered) : '—'}
              sub={summary ? `${summary.opened} opens*` : undefined}
            />
            <StatTile
              label="Click rate"
              term="Click rate"
              value={summary ? pct(summary.clicked, summary.delivered) : '—'}
              sub={summary ? `${summary.clicked} clicks` : undefined}
              accent
            />
          </div>

          <div className="mt-4 space-y-2">
            {configs.map((config) => (
              <AutomationCard
                key={config.email_type}
                config={config}
                expanded={expanded === config.email_type}
                onToggleExpand={() =>
                  setExpanded((current) => (current === config.email_type ? null : config.email_type))
                }
                onChanged={load}
              />
            ))}
          </div>

          {totalSent > 0 && (
            <p className="mt-3 text-xs italic text-slate-500">
              * Opens are approximate — image proxies and privacy features inflate them. Decide from
              clicks.
            </p>
          )}
        </>
      )}

      <RecipientsModal
        open={recipientsOpen}
        recipients={recipients}
        loading={recipientsLoading}
        onClose={() => setRecipientsOpen(false)}
      />
    </section>
  );
}
