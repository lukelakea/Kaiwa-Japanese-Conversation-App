import { useCallback, useMemo } from 'react';

import { DEFAULT_APP_SETTINGS } from '../types/settings';
import type { AppSettings } from '../types/settings';
import { usePersistedState } from './usePersistedState';

/** Old localStorage key, read once to migrate existing data to the backend. */
const LEGACY_KEY = 'kaiwa:app-settings';

function loadLegacy(): Partial<AppSettings> | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<AppSettings>;
  } catch {
    return null;
  }
}

export function useAppSettings() {
  // Stored as a (possibly partial) patch over the defaults, persisted to the
  // backend document store. Defaults are merged on read so a settings object
  // saved before a new field existed still picks up that field's default.
  const [stored, setStored] = usePersistedState<Partial<AppSettings>>(
    'app-settings',
    loadLegacy,
    {},
  );

  const settings = useMemo<AppSettings>(() => ({ ...DEFAULT_APP_SETTINGS, ...stored }), [stored]);

  const update = useCallback(
    (patch: Partial<AppSettings>) => {
      setStored((prev) => ({ ...prev, ...patch }));
    },
    [setStored],
  );

  return { settings, update };
}
