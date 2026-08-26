/** Send status pill. Extracted from the Recent Sends list. */
export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    succeeded: 'bg-emerald-50 text-emerald-700',
    failed: 'bg-red-50 text-red-700',
    sending: 'bg-amber-50 text-amber-700',
    queued: 'bg-amber-50 text-amber-700',
    started: 'bg-amber-50 text-amber-700',
  };
  const labels: Record<string, string> = {
    succeeded: 'Sent',
    failed: 'Failed',
    sending: 'Sending',
    queued: 'Queued',
    started: 'Sending',
  };

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
        styles[status] ?? 'bg-slate-100 text-slate-500'
      }`}
    >
      {labels[status] ?? status}
    </span>
  );
}
