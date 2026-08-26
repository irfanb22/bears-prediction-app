/** Success / error banner. Extracted verbatim from AdminEmailDashboard. */
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Notice } from './types';

export function NoticeBanner({ notice }: { notice: Notice }) {
  return (
    <AnimatePresence>
      {notice && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className={`mt-6 flex items-start gap-3 rounded-2xl border px-4 py-4 shadow-sm ${
            notice.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {notice.tone === 'success' ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
          )}
          <span className="text-sm font-medium">{notice.message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
