import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ConversationSettings } from '../types/conversation';
import { ApiError, checkHealth, requestFeedback, streamChat, tokenize } from './client';

const SETTINGS: ConversationSettings = {
  difficulty: 'intermediate',
  formality: 'polite',
  initiative: 'balanced',
};

/** Build a minimal `Response`-like stub for the fetch mock. */
function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  } as Response;
}

/** A streaming `Response` whose body yields the given UTF-8 chunks once. */
function streamResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  let i = 0;
  return {
    ok: true,
    status: 200,
    body: {
      getReader: () => ({
        read: async () =>
          i < chunks.length
            ? { done: false, value: encoder.encode(chunks[i++]) }
            : { done: true, value: undefined },
      }),
    },
  } as unknown as Response;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('requestFeedback', () => {
  it('POSTs text, context, and settings and returns the parsed feedback', async () => {
    const feedback = { acceptable: true, labels: [], correction: null, explanation: 'Good.' };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(feedback));
    vi.stubGlobal('fetch', fetchMock);

    const result = await requestFeedback('元気です', 'お元気ですか', SETTINGS);

    expect(result).toEqual(feedback);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/feedback');
    expect(JSON.parse(init.body)).toEqual({
      text: '元気です',
      context: 'お元気ですか',
      settings: SETTINGS,
    });
  });

  it('throws an ApiError carrying the backend detail on a non-ok response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ detail: 'Model unreachable' }, { ok: false, status: 502 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(requestFeedback('x', null, SETTINGS)).rejects.toThrowError(
      new ApiError('Model unreachable'),
    );
  });
});

describe('tokenize', () => {
  it('returns the tokens and detected grammar from the response', async () => {
    const tokens = [{ surface: '本', lemma: '本', reading: 'ほん' }];
    const grammar = [
      {
        patternId: 'te-iru',
        name: '〜ている',
        gloss: 'ongoing action',
        explanation: '…',
        tokenIndices: [0],
      },
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ tokens, grammar })));

    expect(await tokenize('本')).toEqual({ tokens, grammar });
  });

  it('defaults grammar to an empty array when the response omits it', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ tokens: [] })));

    expect(await tokenize('本')).toEqual({ tokens: [], grammar: [] });
  });
});

describe('streamChat', () => {
  it('decodes each body chunk into an onDelta call', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse(['こん', 'にちは'])));
    const deltas: string[] = [];

    await streamChat(
      { messages: [], settings: SETTINGS, mode: 'free_talk' },
      { onDelta: (d) => deltas.push(d) },
    );

    expect(deltas.join('')).toBe('こんにちは');
  });

  it('maps a network failure to a friendly ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(
      streamChat({ messages: [], settings: SETTINGS, mode: 'free_talk' }, { onDelta: () => {} }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});

describe('checkHealth', () => {
  it('returns true when the endpoint is ok and false when fetch throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ status: 'ok', provider: 'ollama', model: 'gemma3:27b' }),
      } as unknown as Response),
    );
    expect(await checkHealth()).toBe(true);

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    expect(await checkHealth()).toBe(false);
  });
});
