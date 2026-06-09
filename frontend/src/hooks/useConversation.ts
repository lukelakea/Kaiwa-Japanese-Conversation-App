import { useCallback, useRef, useState } from 'react';

import { ApiError, streamChat, tokenize, translate } from '../api/client';
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

  // Latest messages, readable from stable callbacks without re-creating them.
  const messagesRef = useRef<Message[]>(messages);
  messagesRef.current = messages;

  const patchMessage = useCallback((id: string, patch: Partial<Message>) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }, []);

  const appendDelta = useCallback((id: string, delta: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, content: m.content + delta } : m)),
    );
  }, []);

  const dropIfEmpty = useCallback((id: string) => {
    setMessages((prev) => prev.filter((m) => !(m.id === id && m.content === '')));
  }, []);

  // Tokenise a completed reply (brief §6 step 2) so furigana and hover-lookup
  // become available. Best-effort: on failure the reply still renders as plain
  // text, just without reading aids.
  const tokenizeMessage = useCallback(
    async (id: string, text: string) => {
      if (!text.trim()) return;
      try {
        const tokens = await tokenize(text);
        patchMessage(id, { tokens });
      } catch {
        // Leave the message un-tokenised; plain text is a fine fallback.
      }
    },
    [patchMessage],
  );

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

      // Accumulate the reply locally so the final text is available to tokenise
      // without re-deriving it from state.
      let full = '';

      try {
        await streamChat(
          { messages: history, settings, mode: 'free_talk' },
          {
            signal: controller.signal,
            onDelta: (delta) => {
              full += delta;
              appendDelta(assistantId, delta);
            },
          },
        );
        setStatus('idle');
        void tokenizeMessage(assistantId, full);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          dropIfEmpty(assistantId);
          setStatus('idle');
          // A stopped reply still keeps any partial content (see dropIfEmpty),
          // so tokenise what was produced.
          void tokenizeMessage(assistantId, full);
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
    [messages, status, appendDelta, dropIfEmpty, tokenizeMessage],
  );

  // Translate an assistant reply on demand (brief §6 step 3). Stable identity:
  // reads current messages from a ref so toggling translation never re-creates
  // this callback (which would retrigger the effect that calls it).
  const requestTranslation = useCallback(
    async (id: string) => {
      const target = messagesRef.current.find((m) => m.id === id);
      if (!target || target.role !== 'assistant' || !target.content.trim()) return;
      if (target.translation !== undefined || target.translationStatus === 'loading') return;

      patchMessage(id, { translationStatus: 'loading' });
      try {
        const translation = await translate(target.content);
        patchMessage(id, { translation, translationStatus: undefined });
      } catch {
        patchMessage(id, { translationStatus: 'error' });
      }
    },
    [patchMessage],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    setStatus('idle');
  }, []);

  return { messages, status, error, send, stop, reset, requestTranslation };
}
