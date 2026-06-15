import { useCallback, useEffect, useState } from 'react';

import type { SavedScenario } from '../types/scenario';

const STORAGE_KEY = 'kaiwa.customScenarios.v1';

function load(): SavedScenario[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as SavedScenario[]) : [];
  } catch {
    return [];
  }
}

export interface SavedScenarios {
  scenarios: SavedScenario[];
  save: (scenario: SavedScenario) => void;
  remove: (id: string) => void;
}

/**
 * User-designed scenarios backed by localStorage. Upserts by id so editing a
 * saved scenario overwrites it in place rather than creating a duplicate.
 */
export function useSavedScenarios(): SavedScenarios {
  const [scenarios, setScenarios] = useState<SavedScenario[]>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios));
  }, [scenarios]);

  const save = useCallback((scenario: SavedScenario) => {
    setScenarios((prev) => {
      const without = prev.filter((s) => s.id !== scenario.id);
      return [scenario, ...without];
    });
  }, []);

  const remove = useCallback((id: string) => {
    setScenarios((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return { scenarios, save, remove };
}
