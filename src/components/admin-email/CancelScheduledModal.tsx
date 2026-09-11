import { Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { formatCentralDateTime } from '../../lib/campaignScheduling';
import type { ScheduledCampaign } from './types';

export function CancelScheduledModal({
  campaign,
  cancelling,
  onClose,
  onConfirm,
}: {
  campaign: ScheduledCampaign | null;
  cancelling: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <AnimatePresence>
      {campaign && (
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
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
          >
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-600">Cancel scheduled send</p>
            <h3 className="mt-2 text-xl font-bold text-bears-navy">{campaign.subject}</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              This email is scheduled for {formatCentralDateTime(campaign.send_at)}. Cancelling keeps
              the audit record but prevents every pending recipient from receiving it.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={onClose} disabled={cancelling} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">
                Keep scheduled
              </button>
              <button type="button" onClick={onConfirm} disabled={cancelling} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
                {cancelling && <Loader2 className="h-4 w-4 animate-spin" />}
                {cancelling ? 'Cancelling…' : 'Cancel send'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
