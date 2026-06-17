import { useCallback } from 'react';

import type { SavedScenario } from '../types/scenario';
import { usePersistedState } from './usePersistedState';

/** Old localStorage key, read once to migrate existing data to the backend. */
const LEGACY_KEY = 'kaiwa.customScenarios.v1';

function loadLegacy(): SavedScenario[] | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as SavedScenario[]) : null;
  } catch {
    return null;
  }
}

export interface SavedScenarios {
  scenarios: SavedScenario[];
  save: (scenario: SavedScenario) => void;
  remove: (id: string) => void;
}

/**
 * User-designed scenarios persisted to the backend document store. Upserts by id
 * so editing a saved scenario overwrites it in place rather than duplicating.
 */
export function useSavedScenarios(): SavedScenarios {
  const [scenarios, setScenarios] = usePersistedState<SavedScenario[]>('scenarios', loadLegacy, []);

  const save = useCallback(
    (scenario: SavedScenario) => {
      setScenarios((prev) => {
        const without = prev.filter((s) => s.id !== scenario.id);
        return [scenario, ...without];
      });
    },
    [setScenarios],
  );

  const remove = useCallback(
    (id: string) => {
      setScenarios((prev) => prev.filter((s) => s.id !== id));
    },
    [setScenarios],
  );

  return { scenarios, save, remove };
}
