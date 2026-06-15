import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';

import { translate } from '../../api/client';
import { transitions } from '../../config/motion';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import type { ConversationStatus } from '../../hooks/useConversation';
import { MicIcon, MicOffIcon, SendIcon, StopIcon } from '../ui/icons';

interface MessageInputProps {
  status: ConversationStatus;
  onSend: (text: string) => void;
  onStop: () => void;
  /** Text to load into the input — set when the user rewinds a message to edit it. */
  draftText?: string;
  /** Increments each time `draftText` should be applied, even if the text is unchanged. */
  draftKey?: number;
  /** Show a debounced English translation preview of the draft above the input. */
  showTranslationPreview?: boolean;
}

const MAX_HEIGHT_PX = 200;
const TRANSLATION_DEBOUNCE_MS = 600;

export function MessageInput({
  status,
  onSend,
  onStop,
  draftText,
  draftKey,
  showTranslationPreview,
}: MessageInputProps) {
  const [text, setText] = useState('');
  const [translation, setTranslation] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isStreaming = status === 'streaming';
  const canSend = text.trim().length > 0 && !isStreaming;

  // Debounce a preview translation of the draft as the user types.
  useEffect(() => {
    const trimmed = text.trim();
    if (!showTranslationPreview || !trimmed) {
      setTranslation(null);
      setIsTranslating(false);
      return;
    }

    setIsTranslating(true);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      translate(trimmed, controller.signal)
        .then((result) => {
          setTranslation(result);
          setIsTranslating(false);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === 'AbortError') return;
          setTranslation(null);
          setIsTranslating(false);
        });
    }, TRANSLATION_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [text, showTranslationPreview]);

  // Load a rewound message back into the input for editing.
  useEffect(() => {
    if (draftKey === undefined || draftKey === 0) return;
    setText(draftText ?? '');
    textareaRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  const {
    status: recorderStatus,
    error: recorderError,
    start,
    stop,
    clearError,
  } = useAudioRecorder();
  const isRecording = recorderStatus === 'recording';
  const isProcessing = recorderStatus === 'processing';
  const micBusy = isRecording || isProcessing;

  // Auto-grow the textarea up to a cap, then scroll.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, [text]);

  const submit = () => {
    if (!canSend) return;
    onSend(text);
    setText('');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends; Shift+Enter inserts a newline. `isComposing` guards against
    // submitting while confirming an IME conversion — essential for Japanese.
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  const handleMicClick = async () => {
    if (isRecording) {
      stop((transcript) => {
        // Append to any existing text rather than replacing it, so the user
        // can build up a message across multiple recordings or combine
        // typed and spoken input.
        setText((current) => {
          if (!current.trim()) return transcript;
          const needsSpace = !/\s$/.test(current);
          return current + (needsSpace ? ' ' : '') + transcript;
        });
        // Focus the textarea so the user can review/edit before sending.
        textareaRef.current?.focus();
      });
    } else if (!isProcessing && !isStreaming) {
      await start();
    }
  };

  return (
    <div className="border-t border-border bg-surface-1/80 backdrop-blur">
      {recorderError && (
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 pt-2">
          <p className="text-xs text-red-400">{recorderError}</p>
          <button
            type="button"
            onClick={clearError}
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            Dismiss
          </button>
        </div>
      )}
      <AnimatePresence>
        {showTranslationPreview && text.trim() && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={transitions.spring}
            className="mx-auto w-full max-w-3xl overflow-hidden px-4"
          >
            <p className="pt-2 text-sm text-zinc-500">
              {translation ?? (isTranslating ? 'Translating…' : '')}
              {translation && isTranslating && (
                <span className="ml-1.5 text-zinc-600">…</span>
              )}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="mx-auto flex w-full max-w-3xl items-end gap-2 px-4 py-3">
        {/* Mic button — always shown; disabled while the AI is streaming */}
        <motion.button
          type="button"
          onClick={() => void handleMicClick()}
          disabled={isStreaming}
          whileTap={{ scale: 0.92 }}
          transition={transitions.spring}
          aria-label={isRecording ? 'Stop recording' : 'Start voice input'}
          title={isRecording ? 'Stop recording' : 'Record voice input'}
          className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors
            ${
              isRecording
                ? 'bg-red-600/80 text-white hover:bg-red-500'
                : isProcessing
                  ? 'cursor-wait bg-surface-2 text-zinc-500'
                  : 'bg-surface-2 text-zinc-400 hover:bg-white/10 hover:text-zinc-200 disabled:cursor-not-allowed disabled:text-zinc-600'
            }`}
        >
          {isRecording && (
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-xl bg-red-500/40"
              animate={{ opacity: [0.5, 0], scale: [1, 1.35] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
            />
          )}
          {isRecording ? (
            <MicOffIcon className="h-5 w-5" />
          ) : (
            <MicIcon className={`h-5 w-5 ${isProcessing ? 'opacity-40' : ''}`} />
          )}
        </motion.button>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={micBusy}
          placeholder={
            isRecording
              ? '録音中… もう一度クリックで終了'
              : isProcessing
                ? '文字起こし中…'
                : '日本語でメッセージを入力…'
          }
          className="jp-text max-h-[200px] flex-1 resize-none rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-zinc-100 placeholder:text-zinc-500 transition-colors focus:border-accent-500/60 focus:outline-none disabled:opacity-50"
        />

        {isStreaming ? (
          <motion.button
            type="button"
            onClick={onStop}
            whileTap={{ scale: 0.92 }}
            transition={transitions.spring}
            aria-label="Stop generating"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-zinc-300 transition-colors hover:bg-white/10"
          >
            <StopIcon className="h-4 w-4" />
          </motion.button>
        ) : (
          <motion.button
            type="button"
            onClick={submit}
            disabled={!canSend}
            whileTap={{ scale: 0.92 }}
            transition={transitions.spring}
            aria-label="Send message"
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-600 text-white transition-colors hover:bg-accent-500 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-zinc-600 ${
              canSend ? 'shadow-accent-glow' : ''
            }`}
          >
            <SendIcon className="h-5 w-5" />
          </motion.button>
        )}
      </div>
    </div>
  );
}
