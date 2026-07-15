/**
 * Manages microphone recording and STT transcription (Phase 5).
 *
 * Lifecycle: idle → recording (user clicked mic) → processing (uploading to
 * /api/stt) → idle. The caller receives the transcript via `onTranscript`.
 */

import { useCallback, useRef, useState } from 'react';

import { transcribe } from '../api/client';

export type RecorderStatus = 'idle' | 'recording' | 'processing';

interface UseAudioRecorderReturn {
  status: RecorderStatus;
  error: string | null;
  /** Start capturing microphone audio. */
  start: () => Promise<void>;
  /**
   * Stop capturing and transcribe. Calls `onTranscript` with the result on
   * success, or sets `error` on failure.
   */
  stop: (onTranscript: (text: string) => void) => void;
  clearError: () => void;
}

// Preferred in order: both are what the backend's Google STT provider knows how
// to map to a Google encoding. Without an explicit mimeType, each browser picks
// its own default (Chrome: WebM/Opus, Firefox: often Ogg/Opus) — always naming
// one keeps the recorded container consistent with what the backend expects.
const PREFERRED_MIME_TYPES = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm'];

function pickSupportedMimeType(): string | undefined {
  return PREFERRED_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const start = useCallback(async () => {
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError('Microphone access denied. Allow microphone permission and try again.');
      return;
    }

    const mimeType = pickSupportedMimeType();
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorderRef.current = recorder;
    recorder.start();
    setStatus('recording');
  }, []);

  const stop = useCallback((onTranscript: (text: string) => void) => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== 'recording') return;

    recorder.onstop = async () => {
      setStatus('processing');
      const mimeType = recorder.mimeType || 'audio/webm';
      const blob = new Blob(chunksRef.current, { type: mimeType });
      // Release the mic as soon as recording stops.
      recorder.stream.getTracks().forEach((t) => t.stop());

      try {
        const text = await transcribe(blob);
        onTranscript(text);
      } catch {
        setError('Transcription failed. Please try again.');
      } finally {
        setStatus('idle');
      }
    };

    recorder.stop();
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { status, error, start, stop, clearError };
}
