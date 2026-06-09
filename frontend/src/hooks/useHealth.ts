import { useEffect, useState } from 'react';

import { checkHealth } from '../api/client';

export type HealthStatus = 'checking' | 'online' | 'offline';

const POLL_INTERVAL_MS = 15_000;

/**
 * Polls the backend `/api/health` endpoint so the UI can show whether the
 * local server is reachable. Passive: it never blocks interaction — a failed
 * send already surfaces its own error — but a persistent offline dot tells the
 * user the backend (or Ollama behind it) isn't up before they type.
 */
export function useHealth(): HealthStatus {
  const [status, setStatus] = useState<HealthStatus>('checking');

  useEffect(() => {
    let cancelled = false;

    const ping = async () => {
      const ok = await checkHealth();
      if (!cancelled) setStatus(ok ? 'online' : 'offline');
    };

    void ping();
    const timer = setInterval(() => void ping(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return status;
}
