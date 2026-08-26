/**
 * Last stop before a production send. Extracted verbatim from
 * AdminEmailDashboard.
 *
 * There is no dry run for campaigns and no undo once SES accepts a message, so
 * this dialog is the only thing between a click and every subscriber's inbox.
 */
import { Loader2, Send } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export function ConfirmSendModal({
  open,
  recipientCount,
  subject,
  sending,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  recipientCount: number;
  subject: string;
  sending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 px-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"
          >
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-bears-orange">Confirm Send</p>
            <h3 className="mt-2 text-2xl font-bold text-bears-navy">
              Send this draft to {recipientCount} users?
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              This will send the exact composer draft to all subscribed users.
            </p>

            <div className="mt-5 rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-700">
              <div className="font-semibold text-slate-900">Subject</div>
              <div className="mt-1">{subject}</div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={sending}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-bears-orange px-4 py-3 text-sm font-bold text-white transition hover:bg-bears-orange/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Confirm Send
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
