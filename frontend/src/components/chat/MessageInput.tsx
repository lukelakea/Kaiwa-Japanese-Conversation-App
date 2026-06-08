import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';

import type { ConversationStatus } from '../../hooks/useConversation';
import { SendIcon, StopIcon } from '../ui/icons';

interface MessageInputProps {
  status: ConversationStatus;
  onSend: (text: string) => void;
  onStop: () => void;
}

const MAX_HEIGHT_PX = 200;

export function MessageInput({ status, onSend, onStop }: MessageInputProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isStreaming = status === 'streaming';
  const canSend = text.trim().length > 0 && !isStreaming;

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

  return (
    <div className="border-t border-white/10 bg-surface-1/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-3xl items-end gap-2 px-4 py-3">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="日本語でメッセージを入力…"
          className="jp-text max-h-[200px] flex-1 resize-none rounded-xl border border-white/10 bg-surface-2 px-4 py-2.5 text-zinc-100 placeholder:text-zinc-500 focus:border-accent-500/60 focus:outline-none"
        />
        {isStreaming ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop generating"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-zinc-300 transition-colors hover:bg-white/10"
          >
            <StopIcon className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={!canSend}
            aria-label="Send message"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-600 text-white transition-colors hover:bg-accent-500 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-zinc-600"
          >
            <SendIcon className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}
