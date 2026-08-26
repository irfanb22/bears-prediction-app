import type { ReactNode } from 'react';

/**
 * Plain audience count: centred, no tooltip. Deliberately simpler than StatTile,
 * which carries a definition popover because engagement numbers need caveats and
 * "how many people are subscribed" does not.
 */
export function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: number;
  sub?: ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-4 text-center ${
        accent ? 'border-bears-orange/25 bg-orange-50' : 'border-slate-200 bg-white'
      }`}
    >
      <p className={`text-3xl font-black tracking-tight ${accent ? 'text-bears-orange' : 'text-bears-navy'}`}>
        {value}
      </p>
      <p className="mt-1 text-xs font-medium text-slate-500">{label}</p>
      {sub ? <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p> : null}
    </div>
  );
}
