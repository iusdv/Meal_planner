import { AnimatePresence, motion } from 'framer-motion';

type StatusToastProps = {
  message: string;
  tone: 'success' | 'error';
};

const TONE_STYLES: Record<StatusToastProps['tone'], string> = {
  success: 'border-green-200 bg-[#f4faf5] text-green-800',
  error: 'border-red-200 bg-[#fff4f3] text-red-700',
};

export default function StatusToast({ message, tone }: StatusToastProps) {
  return (
    <AnimatePresence>
      {message ? (
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.98 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className={`fixed right-4 top-4 z-50 max-w-sm rounded-2xl border px-4 py-3 text-sm font-medium shadow-[0_10px_28px_rgba(15,23,42,0.08)] ${TONE_STYLES[tone]}`}
        >
          {message}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
