import { useCallback } from 'react';

import type { SavedGrammar } from '../types/feedback';
import { usePersistedState } from './usePersistedState';

/** Old localStorage key, read once to migrate existing data to the backend. */
const LEGACY_KEY = 'kaiwa.grammar.v1';

function loadLegacy(): SavedGrammar[] | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as SavedGrammar[]) : null;
  } catch {
    return null;
  }
}

const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `g${Date.now()}-${Math.random().toString(36).slice(2)}`;

export interface SavedGrammarStore {
  items: SavedGrammar[];
  /** Whether this original/correction pair is already saved. */
  has: (original: string, correction: string) => boolean;
  save: (entry: Omit<SavedGrammar, 'id' | 'savedAt'>) => void;
  remove: (id: string) => void;
}

/**
 * Grammar-point save, persisted to the backend document store (brief §7). A
 * personal log of corrections — the user's original sentence plus the corrected
 * Japanese — kept deliberately simple, with a clean model for a possible later
 * export.
 */
export function useSavedGrammar(): SavedGrammarStore {
  const [items, setItems] = usePersistedState<SavedGrammar[]>('grammar', loadLegacy, []);

  const has = useCallback(
    (original: string, correction: string) =>
      items.some((g) => g.original === original && g.correction === correction),
    [items],
  );

  const save = useCallback(
    (entry: Omit<SavedGrammar, 'id' | 'savedAt'>) => {
      setItems((prev) =>
        prev.some((g) => g.original === entry.original && g.correction === entry.correction)
          ? prev
          : [{ ...entry, id: newId(), savedAt: Date.now() }, ...prev],
      );
    },
    [setItems],
  );

  const remove = useCallback(
    (id: string) => {
      setItems((prev) => prev.filter((g) => g.id !== id));
    },
    [setItems],
  );

  return { items, has, save, remove };
}
