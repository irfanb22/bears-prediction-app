import { CalendarClock, Users, X } from 'lucide-react';
import { formatCentralDateTime } from '../../lib/campaignScheduling';
import { SEGMENT_OPTIONS, type ScheduledCampaign } from './types';

export function ScheduledCampaigns({
  campaigns,
  cancellingId,
  onCancel,
}: {
  campaigns: ScheduledCampaign[];
  cancellingId: string | null;
  onCancel: (campaign: ScheduledCampaign) => void;
}) {
  if (campaigns.length === 0) return null;

  return (
    <section className="mt-6 overflow-hidden rounded-3xl border border-sky-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-sky-100 bg-sky-50/70 px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="rounded-2xl bg-sky-100 p-2.5 text-sky-700">
            <CalendarClock className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-bold text-bears-navy">Upcoming sends</h2>
            <p className="text-xs text-slate-500">Queued and handled automatically by the scheduler.</p>
          </div>
        </div>
        <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-bold text-sky-700">
          {campaigns.length} scheduled
        </span>
      </div>

      <div className="divide-y divide-slate-100">
        {campaigns.map((campaign) => {
          const audience =
            SEGMENT_OPTIONS.find((option) => option.value === campaign.segment)?.label ??
            campaign.segment;
          return (
            <div key={campaign.campaign_id} className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-bold text-bears-navy">{campaign.subject}</p>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                    Scheduled
                  </span>
                </div>
                <p className="mt-1 text-sm font-semibold text-sky-700">
                  {formatCentralDateTime(campaign.send_at)}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                  <Users className="h-3.5 w-3.5" />
                  {audience} · {campaign.recipient_count}{' '}
                  {campaign.recipient_count === 1 ? 'recipient' : 'recipients'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onCancel(campaign)}
                disabled={cancellingId === campaign.campaign_id}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" />
                {cancellingId === campaign.campaign_id ? 'Cancelling…' : 'Cancel send'}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
