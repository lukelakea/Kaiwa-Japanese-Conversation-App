import { motion } from 'motion/react';
import { useEffect, useRef } from 'react';

import { bubbleVariants, listStagger } from '../../config/motion';
import type { Message } from '../../types/conversation';
import type { TextSize, TtsSpeed } from '../../types/settings';
import { EmptyState } from './EmptyState';
import { MessageBubble } from './MessageBubble';

interface MessageListProps {
  messages: Message[];
  showFurigana: boolean;
  showRomaji: boolean;
  showTranslation: boolean;
  textSize: TextSize;
  ttsVoice: number | null;
  ttsSpeed: TtsSpeed;
  ttsAutoPlay: boolean;
  /** Whether the most recent user message can be edited and resent. */
  canRewind: boolean;
  onRequestTranslation: (id: string) => void;
  onRequestCorrectionTranslation: (id: string) => void;
  onRetryFeedback: (id: string) => void;
  onRewind: (id: string) => void;
}

export function MessageList({
  messages,
  showFurigana,
  showRomaji,
  showTranslation,
  textSize,
  ttsVoice,
  ttsSpeed,
  ttsAutoPlay,
  canRewind,
  onRequestTranslation,
  onRequestCorrectionTranslation,
  onRetryFeedback,
  onRewind,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Keep the latest message in view as tokens stream in.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  if (messages.length === 0) {
    return <EmptyState />;
  }

  const lastUserIndex = messages.reduce(
    (acc, m, i) => (m.role === 'user' ? i : acc),
    -1,
  );

  return (
    <motion.div
      variants={listStagger}
      initial="hidden"
      animate="visible"
      className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6"
    >
      {messages.map((message, index) => (
        <motion.div key={message.id} variants={bubbleVariants}>
          <MessageBubble
            message={message}
            showFurigana={showFurigana}
            showRomaji={showRomaji}
            showTranslation={showTranslation}
            textSize={textSize}
            ttsVoice={ttsVoice}
            ttsSpeed={ttsSpeed}
            ttsAutoPlay={ttsAutoPlay}
            canRewind={canRewind && index === lastUserIndex}
            onRequestTranslation={onRequestTranslation}
            onRequestCorrectionTranslation={onRequestCorrectionTranslation}
            onRetryFeedback={onRetryFeedback}
            onRewind={onRewind}
          />
        </motion.div>
      ))}
      <div ref={bottomRef} />
    </motion.div>
  );
}
