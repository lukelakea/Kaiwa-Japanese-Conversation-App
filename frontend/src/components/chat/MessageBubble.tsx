import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

import { synthesize } from '../../api/client';
import type { Message } from '../../types/conversation';
import type { Token } from '../../types/reading';
import type { TextSize, TtsSpeed } from '../../types/settings';
import { TEXT_SIZE_CLASS } from '../../types/settings';
import { EditIcon, RetryIcon, SpeakerIcon, StopIcon } from '../ui/icons';
import { Tooltip } from '../ui/Tooltip';
import { activeTokenAt, alignMorasToTokens, type TokenTiming } from '../reading/alignTiming';
import { TokenizedText } from '../reading/TokenizedText';
import { FeedbackAnnotation } from './FeedbackAnnotation';
import { TranslationText } from './TranslationText';

interface MessageBubbleProps {
  message: Message;
  showFurigana: boolean;
  showRomaji: boolean;
  showTranslation: boolean;
  textSize: TextSize;
  ttsVoice: number | null;
  ttsSpeed: TtsSpeed;
  ttsAutoPlay: boolean;
  /** Whether user messages can currently be edited/rewound (not while streaming). */
  canRewind: boolean;
  onRequestTranslation: (id: string) => void;
  onRequestCorrectionTranslation: (id: string) => void;
  onRetryFeedback: (id: string) => void;
  onRewind: (id: string) => void;
  onRegenerate: (id: string) => void;
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
  onRegenerate,
}: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isPending = message.role === 'assistant' && message.content === '';
  // An assistant reply with text but no tokens yet is still streaming — show a
  // blinking caret until kuromoji tokens arrive and TokenizedText takes over.
  const isStreaming =
    message.role === 'assistant' && message.content !== '' && message.tokens === undefined;

  // Index of the token currently being spoken, set by TtsButton during playback
  // (or by a single-word click below) so TokenizedText can highlight it in sync
  // with the audio (Phase 5).
  const [activeTokenIndex, setActiveTokenIndex] = useState<number | null>(null);

  // Show a "warming up" hint if the model takes longer than a few seconds to
  // produce its first token — common on cold start with large Ollama models.
  const [showWarmup, setShowWarmup] = useState(false);
  useEffect(() => {
    if (!isPending) {
      setShowWarmup(false);
      return;
    }
    const timer = setTimeout(() => setShowWarmup(true), 4000);
    return () => clearTimeout(timer);
  }, [isPending]);

  const ttsButtonRef = useRef<TtsButtonHandle>(null);
  const wordAudioRef = useRef<HTMLAudioElement | null>(null);
  const wordBlobUrlRef = useRef<string | null>(null);

  const stopWordAudio = () => {
    wordAudioRef.current?.pause();
    if (wordBlobUrlRef.current) {
      URL.revokeObjectURL(wordBlobUrlRef.current);
      wordBlobUrlRef.current = null;
    }
    wordAudioRef.current = null;
  };

  useEffect(() => stopWordAudio, []);

  // Click-to-pronounce: speak a single word on demand, independent of the main
  // message playback (which is paused first to avoid overlapping audio).
  const handleTokenClick = async (index: number) => {
    const token = message.tokens?.[index];
    if (!token || !token.surface.trim()) return;

    ttsButtonRef.current?.stop();
    stopWordAudio();

    try {
      const { audio: buffer, mimeType } = await synthesize(token.surface, ttsVoice);
      const url = URL.createObjectURL(new Blob([buffer], { type: mimeType }));
      wordBlobUrlRef.current = url;
      const audio = new Audio(url);
      audio.playbackRate = ttsSpeed;
      wordAudioRef.current = audio;
      const cleanup = () => {
        setActiveTokenIndex((current) => (current === index ? null : current));
        URL.revokeObjectURL(url);
        wordBlobUrlRef.current = null;
        wordAudioRef.current = null;
      };
      audio.onended = cleanup;
      audio.onerror = cleanup;
      setActiveTokenIndex(index);
      await audio.play();
    } catch {
      setActiveTokenIndex((current) => (current === index ? null : current));
    }
  };

  // Fetch the translation the first time it's needed for this message. Guarded
  // so it runs once: assistant replies wait for tokens (i.e. not while
  // streaming), user messages translate as soon as they exist; neither
  // auto-retries after an error.
  useEffect(() => {
    if (
      showTranslation &&
      message.content.trim() &&
      message.translation === undefined &&
      message.translationStatus === undefined &&
      (message.role === 'user' || message.tokens !== undefined)
    ) {
      onRequestTranslation(message.id);
    }
  }, [
    showTranslation,
    message.role,
    message.tokens,
    message.content,
    message.translation,
    message.translationStatus,
    message.id,
    onRequestTranslation,
  ]);

  // Fetch a translation of the suggested correction once feedback arrives, so
  // it's ready by the time the user expands the annotation.
  useEffect(() => {
    if (
      showTranslation &&
      message.feedback?.correction &&
      message.correctionTranslation === undefined &&
      message.correctionTranslationStatus === undefined
    ) {
      onRequestCorrectionTranslation(message.id);
    }
  }, [
    showTranslation,
    message.feedback,
    message.correctionTranslation,
    message.correctionTranslationStatus,
    message.id,
    onRequestCorrectionTranslation,
  ]);

  const iconButtonClass =
    'text-zinc-600 transition-colors hover:text-zinc-300 shrink-0';

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
          isUser
            ? 'rounded-br-md bg-accent-600/90 text-white'
            : 'rounded-bl-md border-l-2 border-accent-700/40 bg-surface-2 text-zinc-100'
        }`}
      >
        {isPending ? (
          <>
            <TypingDots />
            {showWarmup && (
              <p className="mt-0.5 text-xs text-zinc-600">Warming up…</p>
            )}
          </>
        ) : message.tokens ? (
          <TokenizedText
            tokens={message.tokens}
            grammar={message.grammar}
            showFurigana={showFurigana}
            showRomaji={showRomaji}
            textSize={textSize}
            isUser={isUser}
            activeTokenIndex={activeTokenIndex}
            onTokenClick={(index) => void handleTokenClick(index)}
          />
        ) : (
          <p className={`jp-text whitespace-pre-wrap break-words ${TEXT_SIZE_CLASS[textSize]}`}>
            {message.content}
            {isStreaming && (
              <span className="stream-caret" aria-hidden>
                ▍
              </span>
            )}
          </p>
        )}
      </div>

      {/* AI sub-row: speaker + regenerate + translation */}
      {!isUser && !isPending && (
        <div className="mt-1 flex items-center gap-3 px-1">
          <TtsButton
            ref={ttsButtonRef}
            text={message.content}
            tokens={message.tokens}
            ttsVoice={ttsVoice}
            ttsSpeed={ttsSpeed}
            ttsAutoPlay={ttsAutoPlay && !message.fromHistory}
            isStreaming={message.tokens === undefined && message.content !== ''}
            onActiveTokenChange={setActiveTokenIndex}
          />
          {canRewind && (
            <Tooltip label="Regenerate reply">
              <button
                type="button"
                onClick={() => onRegenerate(message.id)}
                aria-label="Regenerate this reply"
                className={iconButtonClass}
              >
                <RetryIcon className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
          )}
          {showTranslation && (
            <TranslationText
              text={message.translation}
              status={message.translationStatus}
              onRetry={() => onRequestTranslation(message.id)}
            />
          )}
        </div>
      )}

      {isUser && showTranslation && (
        <div className="mt-1 max-w-[80%] px-1 text-right">
          <TranslationText
            text={message.translation}
            status={message.translationStatus}
            onRetry={() => onRequestTranslation(message.id)}
          />
        </div>
      )}

      {/* Feedback annotation with pencil inline in the trigger row */}
      {isUser && (message.feedback || message.feedbackStatus) && (
        <FeedbackAnnotation
          message={message}
          showTranslation={showTranslation}
          onRetry={() => onRetryFeedback(message.id)}
          onRetryCorrectionTranslation={() => onRequestCorrectionTranslation(message.id)}
          trailingAction={
            canRewind && (
              <Tooltip label="Edit and resend">
                <button
                  type="button"
                  onClick={() => onRewind(message.id)}
                  aria-label="Edit this message"
                  className={iconButtonClass}
                >
                  <EditIcon className="h-3.5 w-3.5" />
                </button>
              </Tooltip>
            )
          }
        />
      )}

      {/* Standalone pencil row when there's no feedback */}
      {isUser && canRewind && !message.feedback && !message.feedbackStatus && (
        <div className="mt-1 flex items-center px-1">
          <Tooltip label="Edit and resend">
            <button
              type="button"
              onClick={() => onRewind(message.id)}
              aria-label="Edit this message"
              className={iconButtonClass}
            >
              <EditIcon className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        </div>
      )}
    </div>
  );
}

/** Imperative handle so a sibling (the click-to-pronounce handler) can stop playback. */
interface TtsButtonHandle {
  stop: () => void;
}

/** Play/stop button that synthesises speech via VOICEVOX on demand (Phase 5). */
const TtsButton = forwardRef<
  TtsButtonHandle,
  {
    text: string;
    tokens?: Token[];
    ttsVoice: number | null;
    ttsSpeed: TtsSpeed;
    ttsAutoPlay: boolean;
    isStreaming: boolean;
    onActiveTokenChange: (index: number | null) => void;
  }
>(function TtsButton(
  { text, tokens, ttsVoice, ttsSpeed, ttsAutoPlay, isStreaming, onActiveTokenChange },
  ref,
) {
  const [ttsStatus, setTtsStatus] = useState<'idle' | 'loading' | 'playing'>('idle');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const autoPlayFiredRef = useRef(false);
  const tokenTimingsRef = useRef<(TokenTiming | null)[] | null>(null);

  const stopHighlight = () => {
    tokenTimingsRef.current = null;
    onActiveTokenChange(null);
  };

  const playAudio = async () => {
    if (ttsStatus === 'loading') return;
    setTtsStatus('loading');
    try {
      const { audio: buffer, moras, mimeType } = await synthesize(text, ttsVoice);
      const url = URL.createObjectURL(new Blob([buffer], { type: mimeType }));
      blobUrlRef.current = url;
      const audio = new Audio(url);
      audio.playbackRate = ttsSpeed;
      audioRef.current = audio;
      tokenTimingsRef.current = tokens ? alignMorasToTokens(tokens, moras) : null;
      audio.onended = () => {
        setTtsStatus('idle');
        stopHighlight();
        URL.revokeObjectURL(url);
        blobUrlRef.current = null;
      };
      audio.onerror = () => {
        setTtsStatus('idle');
        stopHighlight();
      };
      await audio.play();
      setTtsStatus('playing');
    } catch {
      setTtsStatus('idle');
      stopHighlight();
    }
  };

  const stop = () => {
    if (ttsStatus !== 'playing') return;
    audioRef.current?.pause();
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setTtsStatus('idle');
    stopHighlight();
  };

  useImperativeHandle(ref, () => ({ stop }));

  const handleClick = () => {
    if (ttsStatus === 'playing') {
      stop();
      return;
    }
    void playAudio();
  };

  // While playing, highlight the token whose time range contains the audio's
  // current playback position — independent of `playbackRate`, since
  // `currentTime` advances through the same timeline regardless of speed.
  useEffect(() => {
    if (ttsStatus !== 'playing') return;
    let frame: number;
    const tick = () => {
      const audio = audioRef.current;
      const timings = tokenTimingsRef.current;
      if (audio && timings) {
        onActiveTokenChange(activeTokenAt(timings, audio.currentTime));
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ttsStatus, onActiveTokenChange]);

  // Auto-play fires once per message, after streaming completes.
  useEffect(() => {
    if (!ttsAutoPlay || isStreaming || autoPlayFiredRef.current || !text.trim()) return;
    autoPlayFiredRef.current = true;
    void playAudio();
    // playAudio is stable within the component lifetime; listing ttsAutoPlay/isStreaming
    // as deps would re-trigger, which we explicitly don't want — the ref guards that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ttsAutoPlay, isStreaming]);

  if (!text.trim()) return null;

  return (
    <Tooltip label={ttsStatus === 'playing' ? 'Stop' : 'Read aloud'}>
      <button
        type="button"
        onClick={() => void handleClick()}
        aria-label={ttsStatus === 'playing' ? 'Stop playback' : 'Play message aloud'}
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
    </Tooltip>
  );
});

