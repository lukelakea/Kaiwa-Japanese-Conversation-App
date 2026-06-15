import { useCallback, useRef, useState } from 'react';

import { ApiError, requestFeedback, streamChat, tokenize, translate } from '../api/client';
import type {
  ConversationMode,
  ConversationSettings,
  Message,
  Scenario,
  WireMessage,
} from '../types/conversation';

export type ConversationStatus = 'idle' | 'streaming' | 'error';

let idCounter = 0;
const nextId = (): string => `m${Date.now()}-${idCounter++}`;

const toWire = (messages: Message[]): WireMessage[] =>
  messages.map(({ role, content }) => ({ role, content }));

/** The most recent assistant reply before `index` — the turn being replied to. */
const contextBefore = (messages: Message[], index: number): string | null => {
  for (let i = index - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant' && messages[i].content.trim()) {
      return messages[i].content;
    }
  }
  return null;
};

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

  // Tokenise a completed reply (brief §6 step 2) so furigana, hover-lookup and
  // grammar-construction cards become available. Best-effort: on failure the
  // reply still renders as plain text, just without reading aids.
  const tokenizeMessage = useCallback(
    async (id: string, text: string) => {
      if (!text.trim()) return;
      try {
        const { tokens, grammar } = await tokenize(text);
        patchMessage(id, { tokens, grammar });
      } catch {
        // Leave the message un-tokenised; plain text is a fine fallback.
      }
    },
    [patchMessage],
  );

  // Critique a user message (brief §8). Runs independently of the reply: the
  // feedback depends only on the user's text and the turn it replies to, never
  // on the assistant's answer, so the two LLM calls run in parallel for the
  // lowest latency. Best-effort — a failure marks the message retryable.
  const generateFeedback = useCallback(
    async (id: string, text: string, context: string | null, settings: ConversationSettings) => {
      patchMessage(id, { feedbackStatus: 'loading', feedback: undefined });
      try {
        const feedback = await requestFeedback(text, context, settings);
        patchMessage(id, { feedback, feedbackStatus: undefined });
      } catch {
        patchMessage(id, { feedbackStatus: 'error' });
      }
    },
    [patchMessage],
  );

  // Retry feedback for a user message after a failure. Reconstructs the context
  // (the reply it answered) from current history; uses the live settings since
  // the practised register is what we judge against.
  const retryFeedback = useCallback(
    (id: string, settings: ConversationSettings) => {
      const msgs = messagesRef.current;
      const index = msgs.findIndex((m) => m.id === id);
      if (index < 0 || msgs[index].role !== 'user') return;
      void generateFeedback(id, msgs[index].content, contextBefore(msgs, index), settings);
    },
    [generateFeedback],
  );

  const send = useCallback(
    async (
      text: string,
      settings: ConversationSettings,
      mode: ConversationMode = 'free_talk',
      scenario?: Scenario,
    ) => {
      const content = text.trim();
      if (!content || status === 'streaming') return;

      const userMessage: Message = { id: nextId(), role: 'user', content };
      const assistantId = nextId();
      const history = toWire([...messages, userMessage]);
      // The reply the user is responding to, captured before state updates.
      const feedbackContext = contextBefore(messages, messages.length);

      setError(null);
      setStatus('streaming');
      setMessages((prev) => [
        ...prev,
        userMessage,
        { id: assistantId, role: 'assistant', content: '' },
      ]);

      // Tokenise the user's message so hover/save works on their side too.
      void tokenizeMessage(userMessage.id, content);
      // Kick off feedback alongside the reply (parallel, not sequential).
      void generateFeedback(userMessage.id, content, feedbackContext, settings);

      const controller = new AbortController();
      abortRef.current = controller;

      // Accumulate the reply locally so the final text is available to tokenise
      // without re-deriving it from state.
      let full = '';

      try {
        await streamChat(
          { messages: history, settings, mode, scenario },
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
    [messages, status, appendDelta, dropIfEmpty, tokenizeMessage, generateFeedback],
  );

  // Rewind to a user message: drop it and everything after it (normally just
  // the assistant's reply), returning its text so the caller can restore it
  // to the input for editing. Only valid for the most recent user message —
  // the caller is expected to enforce that, since rewinding further back
  // would silently discard more of the conversation.
  const rewindToMessage = useCallback(
    (id: string): string | null => {
      if (status === 'streaming') return null;
      const msgs = messagesRef.current;
      const index = msgs.findIndex((m) => m.id === id);
      if (index < 0 || msgs[index].role !== 'user') return null;

      setMessages((prev) => prev.slice(0, index));
      setError(null);
      return msgs[index].content;
    },
    [status],
  );

  // Trigger the AI's opening message for a scenario (brief §5). Called once
  // when a scenario is started — the messages list is empty at this point so
  // the AI receives only the system prompt and opens the scene in character.
  const startScenario = useCallback(
    async (scenario: Scenario, settings: ConversationSettings, mode: ConversationMode) => {
      if (status === 'streaming') return;

      const assistantId = nextId();
      setError(null);
      setStatus('streaming');
      setMessages([{ id: assistantId, role: 'assistant', content: '' }]);

      const controller = new AbortController();
      abortRef.current = controller;
      let full = '';

      try {
        await streamChat(
          { messages: [], settings, mode, scenario },
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
          void tokenizeMessage(assistantId, full);
          return;
        }
        dropIfEmpty(assistantId);
        setError(
          err instanceof ApiError ? err.message : 'Something went wrong starting the scenario.',
        );
        setStatus('error');
      } finally {
        abortRef.current = null;
      }
    },
    [status, appendDelta, dropIfEmpty, tokenizeMessage],
  );

  // Translate a message (assistant reply or user message) on demand (brief §6
  // step 3). Stable identity: reads current messages from a ref so toggling
  // translation never re-creates this callback (which would retrigger the
  // effect that calls it).
  const requestTranslation = useCallback(
    async (id: string) => {
      const target = messagesRef.current.find((m) => m.id === id);
      if (!target || !target.content.trim()) return;
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

  // Translate a feedback correction on demand — the same opt-in translation
  // call as `requestTranslation`, but for the suggested Japanese rewrite shown
  // in the feedback annotation rather than the message itself.
  const requestCorrectionTranslation = useCallback(
    async (id: string) => {
      const target = messagesRef.current.find((m) => m.id === id);
      const correction = target?.feedback?.correction;
      if (!target || !correction?.trim()) return;
      if (target.correctionTranslation !== undefined || target.correctionTranslationStatus === 'loading') {
        return;
      }

      patchMessage(id, { correctionTranslationStatus: 'loading' });
      try {
        const correctionTranslation = await translate(correction);
        patchMessage(id, { correctionTranslation, correctionTranslationStatus: undefined });
      } catch {
        patchMessage(id, { correctionTranslationStatus: 'error' });
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

  const restore = useCallback((msgs: Message[]) => {
    abortRef.current?.abort();
    setMessages(msgs.map((m) => ({ ...m, fromHistory: true as const })));
    setError(null);
    setStatus('idle');
  }, []);

  return {
    messages,
    status,
    error,
    send,
    startScenario,
    rewindToMessage,
    stop,
    reset,
    restore,
    requestTranslation,
    requestCorrectionTranslation,
    retryFeedback,
  };
}
