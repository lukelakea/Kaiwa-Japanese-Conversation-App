import { motion } from 'motion/react';

import { fadeRise } from '../../config/motion';

/** Shown before the first message — a gentle prompt to start talking. */
export function EmptyState() {
  return (
    <motion.div
      variants={fadeRise}
      initial="hidden"
      animate="visible"
      className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-3 px-6 text-center"
    >
      <p className="jp-text display-heading text-3xl text-zinc-200">会話を始めましょう</p>
      <p className="text-sm text-zinc-500">
        Type a message in Japanese to start. Adjust difficulty, register, and who leads the
        conversation at any time — even mid-chat.
      </p>
    </motion.div>
  );
}
