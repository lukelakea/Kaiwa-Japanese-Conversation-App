/**
 * Typed client for the Kaiwa backend.
 *
 * The chat endpoint streams the reply as UTF-8 text deltas; `streamChat`
 * exposes that as an `onDelta` callback so the UI can render tokens as they
 * arrive (brief §6 — progressive disclosure).
 */

import type { ChatRequest } from '../types/conversation';

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
