/**
 * Client for the backend document store (`/api/store/{collection}`).
 *
 * The frontend's saved collections — vocab, conversation history, custom
 * scenarios, the grammar log, app settings — are persisted server-side rather
 * than in browser localStorage, so they survive a cleared or changed browser
 * (the data still never leaves the machine). Each collection is one JSON
 * document the server stores opaquely; the upsert/dedup/cap logic lives in the
 * hooks, so this module is just typed load/save.
 */

import { ApiError } from './client';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

/** Fetch a stored collection, or `null` if nothing has been saved yet. */
export async function loadCollection<T>(collection: string): Promise<T | null> {
  const response = await fetch(`${API_BASE_URL}/api/store/${collection}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new ApiError(`Could not load ${collection} (${response.status}).`);
  return (await response.json()) as T;
}

// Writes to a given collection are chained so a slow PUT can never land after a
// newer one and resurrect stale data — fetch makes no ordering guarantee, and
// these whole-document overwrites are last-writer-wins.
const writeChains = new Map<string, Promise<void>>();

/** Overwrite a stored collection. Resolves once the write has landed. */
export function saveCollection<T>(collection: string, value: T): Promise<void> {
  const run = (writeChains.get(collection) ?? Promise.resolve())
    .catch(() => undefined)
    .then(async () => {
      const response = await fetch(`${API_BASE_URL}/api/store/${collection}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(value),
      });
      if (!response.ok) throw new ApiError(`Could not save ${collection} (${response.status}).`);
    });
  writeChains.set(collection, run);
  return run;
}
