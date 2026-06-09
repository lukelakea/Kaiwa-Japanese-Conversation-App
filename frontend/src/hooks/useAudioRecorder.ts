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

    const recorder = new MediaRecorder(stream);
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
