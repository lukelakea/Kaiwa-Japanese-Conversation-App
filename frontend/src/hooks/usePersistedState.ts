import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import { loadCollection, saveCollection } from '../api/storage';

/**
 * State backed by the backend document store, so saved data survives a cleared
 * or changed browser (it replaces the old localStorage persistence).
 *
 * Behaves like `useState`, with three additions:
 *
 *  - The initial value loads asynchronously. Until it arrives, `value` is
 *    `initial`; `loaded` (the third tuple element) flips to `true` once the
 *    real value is in place.
 *  - Changes are persisted to `collection` after load. The echo of the freshly
 *    loaded value is *not* written straight back.
 *  - `migrate` runs once when the server has nothing stored: it reads the old
 *    localStorage value (if any) and seeds the store with it, so a user's
 *    existing local data is carried over on first run rather than lost.
 *
 * `migrate` is captured on first render; pass a stable (module-level) function.
 */
export function usePersistedState<T>(
  collection: string,
  migrate: () => T | null,
  initial: T,
): [T, Dispatch<SetStateAction<T>>, boolean] {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);

  // Skip persisting until hydrated, and skip the one render that applies the
  // hydrated value — writing the just-loaded value back would be a wasted PUT.
  const skipSave = useRef(true);
  const migrateRef = useRef(migrate);

  useEffect(() => {
    let active = true;
    loadCollection<T>(collection)
      .then((stored) => {
        if (!active) return;
        if (stored !== null) {
          setValue(stored);
          return;
        }
        // Nothing on the server yet: carry over any pre-backend localStorage
        // data, and let it persist up (don't skip the save below).
        const legacy = migrateRef.current();
        if (legacy !== null) {
          skipSave.current = false;
          setValue(legacy);
        }
      })
      .catch(() => {
        // Backend unreachable: fall back to localStorage so the user's data is
        // still visible. Stay in skip-save mode — without the server we have
        // nowhere durable to write, and the app is largely unusable anyway.
        const legacy = migrateRef.current();
        if (active && legacy !== null) setValue(legacy);
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [collection]);

  useEffect(() => {
    if (!loaded) return;
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    void saveCollection(collection, value).catch((err) => {
      console.error(`Failed to persist ${collection}:`, err);
    });
  }, [collection, loaded, value]);

  return [value, setValue, loaded];
}
