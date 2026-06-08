import { useCallback, useRef, useState } from 'react';

import { ApiError, streamChat } from '../api/client';
import type { ConversationSettings, Message, WireMessage } from '../types/conversation';

export type ConversationStatus = 'idle' | 'streaming' | 'error';

let idCounter = 0;
const nextId = (): string => `m${Date.now()}-${idCounter++}`;

const toWire = (messages: Message[]): WireMessage[] =>
  messages.map(({ role, content }) => ({ role, content }));

/**
 * Drives a single conversation: holds the message history, sends a turn, and
 * streams the assistant reply token-by-token into the last message.
 *
 * The full history is sent each turn (brief §9). Settings are passed in at send
 * time so mid-conversation changes apply to the next turn, never retroactively.
 */
export function useConversation() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<ConversationStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const appendDelta = useCallback((id: string, delta: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, content: m.content + delta } : m)),
    );
  }, []);

  const dropIfEmpty = useCallback((id: string) => {
    setMessages((prev) => prev.filter((m) => !(m.id === id && m.content === '')));
  }, []);

  const send = useCallback(
    async (text: string, settings: ConversationSettings) => {
      const content = text.trim();
      if (!content || status === 'streaming') return;

      const userMessage: Message = { id: nextId(), role: 'user', content };
      const assistantId = nextId();
      const history = toWire([...messages, userMessage]);

      setError(null);
      setStatus('streaming');
      setMessages((prev) => [
        ...prev,
        userMessage,
        { id: assistantId, role: 'assistant', content: '' },
      ]);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await streamChat(
          { messages: history, settings, mode: 'free_talk' },
          { signal: controller.signal, onDelta: (delta) => appendDelta(assistantId, delta) },
        );
        setStatus('idle');
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          dropIfEmpty(assistantId);
          setStatus('idle');
          return;
        }
        dropIfEmpty(assistantId);
        setError(
          err instanceof ApiError ? err.message : 'Something went wrong generating the reply.',
        );
        setStatus('error');
      } finally {
        abortRef.current = null;
      }
    },
    [messages, status, appendDelta, dropIfEmpty],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    setStatus('idle');
  }, []);

  return { messages, status, error, send, stop, reset };
}
