/**
 * Typed client for the Kaiwa backend.
 *
 * The chat endpoint streams the reply as UTF-8 text deltas; `streamChat`
 * exposes that as an `onDelta` callback so the UI can render tokens as they
 * arrive (brief §6 — progressive disclosure).
 */

import type { ChatRequest, ConversationSettings, Scenario } from '../types/conversation';
import type { Feedback } from '../types/feedback';
import type { LookupResult, TokenizedReading } from '../types/reading';

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
 * lemmas, plus detected grammatical constructions (brief §6 step 2).
 * Deterministic, server-side, no LLM.
 */
export async function tokenize(text: string, signal?: AbortSignal): Promise<TokenizedReading> {
  const response = await fetch(`${API_BASE_URL}/api/tokenize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
    signal,
  });
  if (!response.ok) throw new ApiError(await extractErrorDetail(response));
  const data = (await response.json()) as TokenizedReading;
  return { tokens: data.tokens, grammar: data.grammar ?? [] };
}

/**
 * Look up a token for hover display: JMdict word senses plus per-kanji detail
 * (brief §7). Pure local-data lookup, no LLM.
 */
export async function lookup(
  surface: string,
  lemma: string,
  pos: string,
  signal?: AbortSignal,
): Promise<LookupResult> {
  const params = new URLSearchParams({ surface, lemma, pos });
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

/**
 * Critique the user's most recent message (brief §8). A separate LLM call run
 * in parallel with the reply; `context` is the assistant turn being replied to
 * (null for the opening message) and `settings` fixes the target register.
 */
export async function requestFeedback(
  text: string,
  context: string | null,
  settings: ConversationSettings,
  signal?: AbortSignal,
): Promise<Feedback> {
  const response = await fetch(`${API_BASE_URL}/api/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, context, settings }),
    signal,
  });
  if (!response.ok) throw new ApiError(await extractErrorDetail(response));
  return (await response.json()) as Feedback;
}

/**
 * Generate a scenario from an optional theme (brief §5 — Generated mode).
 * Uses the LLM with json_mode to produce a structured scenario description.
 */
export async function generateScenario(
  theme: string | null,
  settings: ConversationSettings,
  signal?: AbortSignal,
): Promise<Scenario> {
  const response = await fetch(`${API_BASE_URL}/api/scenario/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ theme: theme || null, settings }),
    signal,
  });
  if (!response.ok) throw new ApiError(await extractErrorDetail(response));
  const data = (await response.json()) as { scenario: Scenario };
  return data.scenario;
}

/**
 * Transcribe an audio blob to Japanese text via faster-whisper (Phase 5).
 * The browser sends WebM/Opus; the backend saves it to a temp file and runs STT.
 */
export async function transcribe(audio: Blob, signal?: AbortSignal): Promise<string> {
  const formData = new FormData();
  formData.append('audio', audio, 'recording.webm');
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/stt`, {
      method: 'POST',
      body: formData,
      signal,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw new ApiError('Could not reach the Kaiwa server. Is the backend running?');
  }
  if (!response.ok) throw new ApiError(await extractErrorDetail(response));
  const data = (await response.json()) as { text: string };
  return data.text;
}

export interface SpeakerOption {
  id: number;
  name: string;
}

/**
 * Fetch available VOICEVOX speakers from the backend. Returns an empty array
 * if VOICEVOX is not running (502) so callers can degrade gracefully.
 */
export async function fetchSpeakers(signal?: AbortSignal): Promise<SpeakerOption[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/tts/speakers`, { signal });
    if (!response.ok) return [];
    return (await response.json()) as SpeakerOption[];
  } catch {
    return [];
  }
}

/**
 * Synthesise Japanese text to speech via VOICEVOX (Phase 5).
 * Returns raw WAV bytes that the caller plays via the Web Audio API.
 * Pass speakerId to override the server default; omit to use the server config.
 */
export async function synthesize(
  text: string,
  speakerId?: number | null,
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  let response: Response;
  const body: Record<string, unknown> = { text };
  if (speakerId != null) body.speaker_id = speakerId;
  try {
    response = await fetch(`${API_BASE_URL}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw new ApiError('Could not reach the Kaiwa server. Is the backend running?');
  }
  if (!response.ok) throw new ApiError(await extractErrorDetail(response));
  return response.arrayBuffer();
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
