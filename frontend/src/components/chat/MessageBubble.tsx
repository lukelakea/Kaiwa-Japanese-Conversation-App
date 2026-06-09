import { useEffect, useRef, useState } from 'react';

import { synthesize } from '../../api/client';
import type { Message } from '../../types/conversation';
import { SpeakerIcon, StopIcon } from '../ui/icons';
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

      {!isUser && !isPending && (
        <div className="mt-1 flex items-center gap-3 px-1">
          <TtsButton text={message.content} />
          {showTranslation && (
            <Translation message={message} onRetry={() => onRequestTranslation(message.id)} />
          )}
        </div>
      )}

      {isUser && (message.feedback || message.feedbackStatus) && (
        <FeedbackAnnotation message={message} onRetry={() => onRetryFeedback(message.id)} />
      )}
    </div>
  );
}

/** Play/stop button that synthesises speech via VOICEVOX on demand (Phase 5). */
function TtsButton({ text }: { text: string }) {
  const [ttsStatus, setTtsStatus] = useState<'idle' | 'loading' | 'playing'>('idle');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  const handleClick = async () => {
    if (ttsStatus === 'playing') {
      audioRef.current?.pause();
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      setTtsStatus('idle');
      return;
    }
    if (ttsStatus === 'loading') return;

    setTtsStatus('loading');
    try {
      const buffer = await synthesize(text);
      const url = URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
      blobUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setTtsStatus('idle');
        URL.revokeObjectURL(url);
        blobUrlRef.current = null;
      };
      audio.onerror = () => setTtsStatus('idle');
      await audio.play();
      setTtsStatus('playing');
    } catch {
      setTtsStatus('idle');
    }
  };

  if (!text.trim()) return null;

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      aria-label={ttsStatus === 'playing' ? 'Stop playback' : 'Play message aloud'}
      title={ttsStatus === 'playing' ? 'Stop' : 'Read aloud'}
      className="flex items-center gap-1 text-zinc-600 transition-colors hover:text-zinc-300"
    >
      {ttsStatus === 'loading' ? (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border border-zinc-600 border-t-zinc-300" />
      ) : ttsStatus === 'playing' ? (
        <StopIcon className="h-3.5 w-3.5 text-accent-400" />
      ) : (
        <SpeakerIcon className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

/** The English translation shown beside the TTS button beneath an assistant reply (brief §6). */
function Translation({ message, onRetry }: { message: Message; onRetry: () => void }) {
  if (message.translationStatus === 'loading') {
    return <p className="text-sm text-zinc-500">Translating…</p>;
  }
  if (message.translationStatus === 'error') {
    return (
      <button
        type="button"
        onClick={onRetry}
        className="text-sm text-zinc-500 underline decoration-dotted underline-offset-2 hover:text-zinc-300"
      >
        Translation failed — retry
      </button>
    );
  }
  if (message.translation) {
    return <p className="text-sm text-zinc-400">{message.translation}</p>;
  }
  return null;
}
