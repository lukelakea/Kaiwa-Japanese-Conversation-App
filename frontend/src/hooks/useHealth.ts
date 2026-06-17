import { useEffect, useState } from 'react';

import { fetchHealth, type HealthInfo } from '../api/client';

export type HealthStatus = 'checking' | 'online' | 'offline';

export interface HealthState {
  status: HealthStatus;
  info: HealthInfo | null;
}

const POLL_INTERVAL_MS = 15_000;

/**
 * Polls the backend `/api/health` endpoint so the UI can show whether the
 * local server is reachable, and which provider + model is active. Passive:
 * it never blocks interaction — a failed send already surfaces its own error.
 */
export function useHealth(): HealthState {
  const [state, setState] = useState<HealthState>({ status: 'checking', info: null });

  useEffect(() => {
    let cancelled = false;

    const ping = async () => {
      const info = await fetchHealth();
      if (!cancelled) setState({ status: info ? 'online' : 'offline', info });
    };

    void ping();
    const timer = setInterval(() => void ping(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return state;
}
