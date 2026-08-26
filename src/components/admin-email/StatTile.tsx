import type { ReactNode } from 'react';
import { InfoTip } from './InfoTip';

/**
 * Engagement tile: left-aligned, with a definition popover and an optional
 * sub-line. Distinct from StatCard, which is the plain centred audience count.
 */
export function StatTile({
  label,
  term,
  value,
  sub,
  accent,
  danger,
  onClick,
}: {
  label: string;
  term?: string;
  value: string | number;
  sub?: ReactNode;
  accent?: boolean;
  danger?: boolean;
  onClick?: () => void;
}) {
  const tone = danger
    ? 'border-red-200 bg-red-50'
    : accent
      ? 'border-bears-orange/25 bg-orange-50'
      : 'border-slate-200 bg-white';
  const valueTone = danger ? 'text-red-700' : accent ? 'text-bears-orange' : 'text-bears-navy';

  return (
    <div
      {...(onClick
        ? {
            role: 'button',
            tabIndex: 0,
            onClick,
            onKeyDown: (event: React.KeyboardEvent) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onClick();
              }
            },
          }
        : {})}
      className={`rounded-2xl border px-4 py-3 ${tone} ${onClick ? 'cursor-pointer transition hover:border-slate-300' : ''}`}
    >
      <div className="flex items-center gap-1">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        {term ? <InfoTip term={term} /> : null}
      </div>
      <p className={`mt-1 text-2xl font-black tracking-tight ${valueTone}`}>{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-slate-500">{sub}</p> : null}
    </div>
  );
}
