import { useState } from 'react';

/**
 * Plain-language definitions for the engagement numbers.
 *
 * These exist because every one of these metrics is easy to read as more certain
 * than it is — particularly opens, which privacy features inflate badly enough
 * that the number is directional at best.
 */
export const STAT_DEFS: Record<string, string> = {
  Delivered:
    "SES accepted the email and handed it to the recipient's mail server. Not a guarantee anyone read it.",
  'Open rate':
    'Share of delivered emails where the tracking pixel loaded. Approximate — Apple Mail Privacy and image proxies pre-load pixels and inflate this, so lean on clicks.',
  'Click rate':
    'Share of delivered emails where the reader clicked a link. The most reliable engagement signal here.',
  Bounced:
    "The email couldn't be delivered — a dead address, a full mailbox, or a domain that rejected it. Hard bounces land on the SES suppression list, and later sends to that address are silently dropped until it's removed.",
  Complained:
    'The recipient marked the email as spam. They are unsubscribed automatically. Keeping this under about 0.1% matters — above that, AWS reviews the whole account.',
  Sent: 'How many messages SES accepted at send time. Different from Delivered, which counts delivery confirmations arriving later.',
  Ready:
    'Content is written and the automation is switched on. It will begin sending once the scheduler is installed.',
};

/**
 * The (i) affordance beside a stat label.
 *
 * Everything here stops propagation on purpose: these tiles live inside
 * click-to-expand rows, and without it, reading a definition would collapse the
 * row underneath you.
 */
export function InfoTip({ term }: { term: string }) {
  const [open, setOpen] = useState(false);
  const def = STAT_DEFS[term];

  if (!def) return null;

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        title={def}
        aria-label={`What "${term}" means`}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className="inline-flex h-[14px] w-[14px] items-center justify-center rounded-full border border-slate-300 text-[9px] font-bold italic leading-none text-slate-400 transition hover:border-slate-400 hover:text-slate-600"
      >
        i
      </button>

      {open && (
        <>
          {/* Catches the next click anywhere so the popover closes. */}
          <span
            className="fixed inset-0 z-40"
            onClick={(event) => {
              event.stopPropagation();
              setOpen(false);
            }}
          />
          <span
            onClick={(event) => event.stopPropagation()}
            className="absolute left-0 top-[calc(100%+6px)] z-50 w-60 max-w-[70vw] rounded-xl border border-slate-200 bg-white p-3 text-left text-[11px] leading-[1.45] text-slate-600 shadow-lg"
          >
            <span className="mb-0.5 block font-bold text-bears-navy">{term}</span>
            {def}
          </span>
        </>
      )}
    </span>
  );
}
