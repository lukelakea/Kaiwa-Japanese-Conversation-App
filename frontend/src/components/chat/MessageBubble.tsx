import { useEffect } from 'react';

import type { Message } from '../../types/conversation';
import { TokenizedText } from '../reading/TokenizedText';
import { FeedbackAnnotation } from './FeedbackAnnotation';

interface MessageBubbleProps {
  message: Message;
  showFurigana: boolean;
  showTranslation: boolean;
  onRequestTranslation: (id: string) => void;
  onRetryFeedback: (id: string) => void;
}

function TypingDots() {
  return (
    <span className="flex items-center gap-1 py-1" aria-label="考え中">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="h-2 w-2 animate-bounce rounded-full bg-zinc-500"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}

export function MessageBubble({
  message,
  showFurigana,
  showTranslation,
  onRequestTranslation,
  onRetryFeedback,
}: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isPending = message.role === 'assistant' && message.content === '';

  // Fetch the translation the first time it's needed for this reply. Guarded so
  // it runs once: not while loading, and not as an auto-retry after an error.
  useEffect(() => {
    if (
      showTranslation &&
      message.role === 'assistant' &&
      message.content.trim() &&
      message.translation === undefined &&
      message.translationStatus === undefined
    ) {
      onRequestTranslation(message.id);
    }
  }, [
    showTranslation,
    message.role,
    message.content,
    message.translation,
    message.translationStatus,
    message.id,
    onRequestTranslation,
  ]);

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
          isUser
            ? 'rounded-br-md bg-accent-600/90 text-white'
            : 'rounded-bl-md bg-surface-2 text-zinc-100'
        }`}
      >
        {isPending ? (
          <TypingDots />
        ) : message.tokens && !isUser ? (
          <TokenizedText tokens={message.tokens} showFurigana={showFurigana} />
        ) : (
          <p className="jp-text whitespace-pre-wrap break-words text-[1.05rem]">
            {message.content}
          </p>
        )}
      </div>

      {!isUser && !isPending && showTranslation && (
        <Translation message={message} onRetry={() => onRequestTranslation(message.id)} />
      )}

      {isUser && (message.feedback || message.feedbackStatus) && (
        <FeedbackAnnotation message={message} onRetry={() => onRetryFeedback(message.id)} />
      )}
    </div>
  );
}

/** The English translation shown beneath an assistant reply (brief §6). */
function Translation({ message, onRetry }: { message: Message; onRetry: () => void }) {
  if (message.translationStatus === 'loading') {
    return <p className="mt-1 max-w-[80%] px-1 text-sm text-zinc-500">Translating…</p>;
  }
  if (message.translationStatus === 'error') {
    return (
      <button
        type="button"
        onClick={onRetry}
        className="mt-1 px-1 text-sm text-zinc-500 underline decoration-dotted underline-offset-2 hover:text-zinc-300"
      >
        Translation failed — retry
      </button>
    );
  }
  if (message.translation) {
    return <p className="mt-1 max-w-[80%] px-1 text-sm text-zinc-400">{message.translation}</p>;
  }
  return null;
}
