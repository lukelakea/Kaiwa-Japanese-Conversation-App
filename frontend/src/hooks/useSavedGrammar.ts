import { useCallback, useEffect, useState } from 'react';

import type { SavedGrammar } from '../types/feedback';

const STORAGE_KEY = 'kaiwa.grammar.v1';

function load(): SavedGrammar[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as SavedGrammar[]) : [];
  } catch {
    return [];
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
 * Grammar-point save backed by localStorage (brief §7). A personal log of
 * corrections — the user's original sentence plus the corrected Japanese — kept
 * deliberately simple. The data model stays clean for a possible later export.
 */
export function useSavedGrammar(): SavedGrammarStore {
  const [items, setItems] = useState<SavedGrammar[]>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const has = useCallback(
    (original: string, correction: string) =>
      items.some((g) => g.original === original && g.correction === correction),
    [items],
  );

  const save = useCallback((entry: Omit<SavedGrammar, 'id' | 'savedAt'>) => {
    setItems((prev) =>
      prev.some((g) => g.original === entry.original && g.correction === entry.correction)
        ? prev
        : [{ ...entry, id: newId(), savedAt: Date.now() }, ...prev],
    );
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((g) => g.id !== id));
  }, []);

  return { items, has, save, remove };
}
