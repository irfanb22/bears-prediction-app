import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { LifecycleRecipient } from '../../lib/lifecycleEmails';

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Who has actually received an automation, newest first. */
export function RecipientsModal({
  open,
  recipients,
  loading,
  onClose,
}: {
  open: boolean;
  recipients: LifecycleRecipient[] | null;
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 px-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-bears-navy">Recipients</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {loading ? 'Loading…' : `${recipients?.length ?? 0} sent`}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              {loading ? (
                <p className="py-8 text-center text-sm text-slate-500">Loading recipients…</p>
              ) : !recipients || recipients.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">No sends yet.</p>
              ) : (
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
                      <th className="pb-2 font-semibold">Email</th>
                      <th className="pb-2 font-semibold">Signed up</th>
                      <th className="pb-2 font-semibold">Sent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipients.map((person) => (
                      <tr
                        key={`${person.email_type}-${person.email}`}
                        className="border-b border-slate-50 text-xs text-slate-600"
                      >
                        <td className="py-2 pr-3">{person.email}</td>
                        <td className="py-2 pr-3 text-slate-400">{formatWhen(person.signed_up_at)}</td>
                        <td className="py-2 text-slate-400">{formatWhen(person.sent_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
