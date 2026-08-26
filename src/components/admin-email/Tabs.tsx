/**
 * Broadcasts / Automations switch.
 *
 * Styled to match the composer's existing Edit/Preview toggle so the two read as
 * one control system rather than two conventions on the same page.
 */
export type DashboardView = 'broadcasts' | 'automations';

export function Tabs({
  view,
  onChange,
}: {
  view: DashboardView;
  onChange: (next: DashboardView) => void;
}) {
  const tabs: Array<{ id: DashboardView; label: string }> = [
    { id: 'broadcasts', label: 'Broadcasts' },
    { id: 'automations', label: 'Automations' },
  ];

  return (
    <div className="mt-6 inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={view === tab.id}
          onClick={() => onChange(tab.id)}
          className={`inline-flex items-center rounded-xl px-5 py-2 text-sm font-semibold transition ${
            view === tab.id
              ? 'bg-white text-bears-navy shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
