import { CalendarClock, FileText, Send, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { EMAIL_TEMPLATES } from '../../lib/emailComposer';
import { CAMPAIGN_TIME_ZONE_LABEL } from '../../lib/campaignScheduling';
import { SEGMENT_OPTIONS, type SegmentCounts, type SegmentName } from './types';

export type DeliveryMode = 'now' | 'schedule';

function StepHeading({ number, title, icon }: { number: number; title: string; icon: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-bears-navy text-xs font-black text-white">
        {number}
      </span>
      <span className="text-sm font-bold text-bears-navy">{title}</span>
      <span className="ml-auto text-slate-400">{icon}</span>
    </div>
  );
}

export function CampaignSetup({
  segment,
  segmentCounts,
  onSegmentChange,
  templateId,
  onTemplateChange,
  onLoadTemplate,
  deliveryMode,
  onDeliveryModeChange,
  scheduledLocal,
  minimumScheduledLocal,
  onScheduledLocalChange,
}: {
  segment: SegmentName;
  segmentCounts: SegmentCounts;
  onSegmentChange: (segment: SegmentName) => void;
  templateId: string;
  onTemplateChange: (templateId: string) => void;
  onLoadTemplate: () => void;
  deliveryMode: DeliveryMode;
  onDeliveryModeChange: (mode: DeliveryMode) => void;
  scheduledLocal: string;
  minimumScheduledLocal: string;
  onScheduledLocalChange: (value: string) => void;
}) {
  const selectedAudience = SEGMENT_OPTIONS.find((option) => option.value === segment);

  return (
    <div className="grid gap-3 border-b border-slate-100 bg-slate-50/70 p-4 lg:grid-cols-3 lg:p-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <StepHeading number={1} title="Audience" icon={<Users className="h-4 w-4" />} />
        <select
          value={segment}
          onChange={(event) => onSegmentChange(event.target.value as SegmentName)}
          className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none transition focus:border-bears-orange focus:ring-2 focus:ring-bears-orange/15"
        >
          {SEGMENT_OPTIONS.map((option) => {
            const count = segmentCounts[option.value];
            return (
              <option key={option.value} value={option.value}>
                {option.label}{count === undefined ? '' : ` · ${count}`}
              </option>
            );
          })}
        </select>
        <p className="mt-2 min-h-8 text-xs leading-4 text-slate-500">{selectedAudience?.description}</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <StepHeading number={2} title="Content" icon={<FileText className="h-4 w-4" />} />
        <select
          value={templateId}
          onChange={(event) => onTemplateChange(event.target.value)}
          className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none transition focus:border-bears-orange focus:ring-2 focus:ring-bears-orange/15"
        >
          {EMAIL_TEMPLATES.map((template) => (
            <option key={template.id} value={template.id}>{template.label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={onLoadTemplate}
          className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-bears-navy"
        >
          Load selected template
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <StepHeading number={3} title="Delivery" icon={<CalendarClock className="h-4 w-4" />} />
        <div className="mt-4 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => onDeliveryModeChange('now')}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition ${
              deliveryMode === 'now' ? 'bg-white text-bears-navy shadow-sm' : 'text-slate-500'
            }`}
          >
            <Send className="h-3.5 w-3.5" /> Send now
          </button>
          <button
            type="button"
            onClick={() => onDeliveryModeChange('schedule')}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition ${
              deliveryMode === 'schedule' ? 'bg-white text-bears-navy shadow-sm' : 'text-slate-500'
            }`}
          >
            <CalendarClock className="h-3.5 w-3.5" /> Schedule
          </button>
        </div>
        {deliveryMode === 'schedule' ? (
          <div className="mt-3">
            <input
              type="datetime-local"
              value={scheduledLocal}
              min={minimumScheduledLocal}
              onChange={(event) => onScheduledLocalChange(event.target.value)}
              className="w-full rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            />
            <p className="mt-2 text-xs text-slate-500">{CAMPAIGN_TIME_ZONE_LABEL}</p>
          </div>
        ) : (
          <p className="mt-3 text-xs leading-5 text-slate-500">Starts immediately after confirmation.</p>
        )}
      </div>
    </div>
  );
}
