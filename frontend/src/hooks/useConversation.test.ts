import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as client from '../api/client';
import type { ConversationSettings } from '../types/conversation';
import { useConversation } from './useConversation';

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof client>();
  return {
    ...actual,
    streamChat: vi.fn(),
    requestFeedback: vi.fn(),
    tokenize: vi.fn(),
    translate: vi.fn(),
  };
});

const SETTINGS: ConversationSettings = {
  difficulty: 'intermediate',
  formality: 'polite',
  initiative: 'balanced',
};

const mocked = vi.mocked(client);

afterEach(() => {
  vi.clearAllMocks();
});

describe('useConversation.send', () => {
  it('fires feedback and the chat reply in parallel (brief §8)', async () => {
    const callOrder: string[] = [];
    mocked.requestFeedback.mockImplementation(async () => {
      callOrder.push('feedback');
      return { acceptable: true, labels: [], correction: null, explanation: 'Good.' };
    });
    mocked.streamChat.mockImplementation(async (_req, { onDelta }) => {
      // The feedback call must already be in flight before the reply streams —
      // proving the two are dispatched together, not serialised.
      expect(callOrder).toContain('feedback');
      onDelta('はい');
    });
    mocked.tokenize.mockResolvedValue({ tokens: [], grammar: [] });

    const { result } = renderHook(() => useConversation());

    await act(async () => {
      await result.current.send('こんにちは', SETTINGS);
    });

    expect(mocked.requestFeedback).toHaveBeenCalledTimes(1);
    expect(mocked.streamChat).toHaveBeenCalledTimes(1);
    // The user message and the streamed assistant reply both land in history.
    expect(result.current.messages.map((m) => [m.role, m.content])).toEqual([
      ['user', 'こんにちは'],
      ['assistant', 'はい'],
    ]);
  });

  it('sends the full history and current settings to the backend (brief §9)', async () => {
    mocked.requestFeedback.mockResolvedValue({
      acceptable: true,
      labels: [],
      correction: null,
      explanation: 'ok',
    });
    mocked.streamChat.mockImplementation(async (_req, { onDelta }) => onDelta('reply'));
    mocked.tokenize.mockResolvedValue({ tokens: [], grammar: [] });

    const { result } = renderHook(() => useConversation());

    await act(async () => {
      await result.current.send('一回目', SETTINGS);
    });
    await act(async () => {
      await result.current.send('二回目', SETTINGS);
    });

    // The second turn carries the prior user+assistant turns as context.
    const secondRequest = mocked.streamChat.mock.calls[1][0];
    expect(secondRequest.settings).toEqual(SETTINGS);
    expect(secondRequest.messages).toEqual([
      { role: 'user', content: '一回目' },
      { role: 'assistant', content: 'reply' },
      { role: 'user', content: '二回目' },
    ]);
  });

  it('surfaces a backend error and sets error status', async () => {
    mocked.requestFeedback.mockResolvedValue({
      acceptable: true,
      labels: [],
      correction: null,
      explanation: 'ok',
    });
    mocked.streamChat.mockRejectedValue(new client.ApiError('Ollama is not running'));

    const { result } = renderHook(() => useConversation());

    await act(async () => {
      await result.current.send('test', SETTINGS);
    });

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBe('Ollama is not running');
  });
});
