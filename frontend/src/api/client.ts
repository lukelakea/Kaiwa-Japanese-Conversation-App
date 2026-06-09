/**
 * Typed client for the Kaiwa backend.
 *
 * The chat endpoint streams the reply as UTF-8 text deltas; `streamChat`
 * exposes that as an `onDelta` callback so the UI can render tokens as they
 * arrive (brief §6 — progressive disclosure).
 */

import type { ChatRequest } from '../types/conversation';
import type { LookupResult, Token } from '../types/reading';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

/** An error carrying a user-presentable message from the backend. */
export class ApiError extends Error {}

interface StreamChatOptions {
  onDelta: (delta: string) => void;
  signal?: AbortSignal;
}

export async function streamChat(
  request: ChatRequest,
  { onDelta, signal }: StreamChatOptions,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw new ApiError('Could not reach the Kaiwa server. Is the backend running?');
  }

  if (!response.ok) {
    throw new ApiError(await extractErrorDetail(response));
  }
  if (!response.body) {
    throw new ApiError('The server returned an empty response.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    onDelta(decoder.decode(value, { stream: true }));
  }
}

/**
 * Tokenise an assistant reply into words with furigana and dictionary-form
 * lemmas (brief §6 step 2). Deterministic, server-side, no LLM.
 */
export async function tokenize(text: string, signal?: AbortSignal): Promise<Token[]> {
  const response = await fetch(`${API_BASE_URL}/api/tokenize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
    signal,
  });
  if (!response.ok) throw new ApiError(await extractErrorDetail(response));
  const data = (await response.json()) as { tokens: Token[] };
  return data.tokens;
}

/**
 * Look up a token for hover display: JMdict word senses plus per-kanji detail
 * (brief §7). Pure local-data lookup, no LLM.
 */
export async function lookup(
  surface: string,
  lemma: string,
  signal?: AbortSignal,
): Promise<LookupResult> {
  const params = new URLSearchParams({ surface, lemma });
  const response = await fetch(`${API_BASE_URL}/api/lookup?${params}`, { signal });
  if (!response.ok) throw new ApiError(await extractErrorDetail(response));
  return (await response.json()) as LookupResult;
}

/**
 * Translate an already-generated Japanese reply to English (brief §6 step 3).
 * A separate, opt-in LLM call returning a single block of text.
 */
export async function translate(text: string, signal?: AbortSignal): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
    signal,
  });
  if (!response.ok) throw new ApiError(await extractErrorDetail(response));
  const data = (await response.json()) as { translation: string };
  return data.translation;
}

export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`);
    return response.ok;
  } catch {
    return false;
  }
}

async function extractErrorDetail(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { detail?: string };
    if (data.detail) return data.detail;
  } catch {
    // Not JSON — fall through to a generic message.
  }
  return `Request failed (${response.status}).`;
}
