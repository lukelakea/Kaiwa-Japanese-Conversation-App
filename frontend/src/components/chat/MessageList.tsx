import { useEffect, useRef } from 'react';

import type { Message } from '../../types/conversation';
import { EmptyState } from './EmptyState';
import { MessageBubble } from './MessageBubble';

interface MessageListProps {
  messages: Message[];
  showFurigana: boolean;
  showTranslation: boolean;
  onRequestTranslation: (id: string) => void;
  onRetryFeedback: (id: string) => void;
}

export function MessageList({
  messages,
  showFurigana,
  showTranslation,
  onRequestTranslation,
  onRetryFeedback,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Keep the latest message in view as tokens stream in.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  if (messages.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          showFurigana={showFurigana}
          showTranslation={showTranslation}
          onRequestTranslation={onRequestTranslation}
          onRetryFeedback={onRetryFeedback}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
