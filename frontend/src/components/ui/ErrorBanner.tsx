import { motion } from 'motion/react';

import { fadeSlide } from '../../config/motion';

/** A non-blocking error strip shown just above the input. Wrapped by an
 *  AnimatePresence at the call site so it slides in and out. */
export function ErrorBanner({ message }: { message: string }) {
  return (
    <motion.div
      role="alert"
      variants={fadeSlide}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="mx-auto w-full max-w-3xl px-4 py-2 text-sm text-red-300"
    >
      <span className="rounded-lg bg-red-500/10 px-3 py-1.5">{message}</span>
    </motion.div>
  );
}
