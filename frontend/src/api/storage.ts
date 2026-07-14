/**
 * Client for the frontend's saved collections — vocab, conversation history,
 * custom scenarios, the grammar log, app settings. Each collection is one opaque
 * JSON document; the upsert/dedup/cap logic lives in the hooks, so this module
 * is just typed load/save.
 *
 * Two backends, chosen by `VITE_STORAGE`:
 *
 *  - `backend` (default) — the local-first document store at `/api/store`, so
 *    data survives a cleared or changed browser and still never leaves the
 *    machine.
 *  - `local` — browser localStorage, for the hosted demo where there is no
 *    per-user server store. Data lives only in that browser.
 *
 * The hooks (`usePersistedState`) treat both identically; only the seam changes.
 */

import { ApiError } from './client';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
const STORAGE_MODE = import.meta.env.VITE_STORAGE ?? 'backend';

// --- localStorage adapter (hosted demo) ------------------------------------

// Namespaced distinctly from the hooks' legacy migration keys (e.g.
// `kaiwa:app-settings`, `kaiwa.vocab.v1`) so a first-run migration still finds
// the old value and seeds this store rather than colliding with it.
const LOCAL_PREFIX = 'kaiwa:store:';

function loadLocal<T>(collection: string): T | null {
  try {
    const raw = localStorage.getItem(LOCAL_PREFIX + collection);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

function saveLocal<T>(collection: string, value: T): void {
  localStorage.setItem(LOCAL_PREFIX + collection, JSON.stringify(value));
}

// --- backend document-store adapter (local-first default) ------------------

async function loadBackend<T>(collection: string): Promise<T | null> {
  const response = await fetch(`${API_BASE_URL}/api/store/${collection}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new ApiError(`Could not load ${collection} (${response.status}).`);
  return (await response.json()) as T;
}

// Writes to a given collection are chained so a slow PUT can never land after a
// newer one and resurrect stale data — fetch makes no ordering guarantee, and
// these whole-document overwrites are last-writer-wins.
const writeChains = new Map<string, Promise<void>>();

function saveBackend<T>(collection: string, value: T): Promise<void> {
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

// --- public API (mode-agnostic) --------------------------------------------

/** Fetch a stored collection, or `null` if nothing has been saved yet. */
export function loadCollection<T>(collection: string): Promise<T | null> {
  if (STORAGE_MODE === 'local') return Promise.resolve(loadLocal<T>(collection));
  return loadBackend<T>(collection);
}

/** Overwrite a stored collection. Resolves once the write has landed. */
export function saveCollection<T>(collection: string, value: T): Promise<void> {
  if (STORAGE_MODE === 'local') {
    try {
      saveLocal(collection, value);
      return Promise.resolve();
    } catch (err) {
      return Promise.reject(err instanceof Error ? err : new Error(String(err)));
    }
  }
  return saveBackend(collection, value);
}
