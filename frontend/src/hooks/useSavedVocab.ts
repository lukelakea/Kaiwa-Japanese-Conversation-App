import { useCallback } from 'react';

import type { SavedWord } from '../types/reading';
import { usePersistedState } from './usePersistedState';

/** Old localStorage key, read once to migrate existing data to the backend. */
const LEGACY_KEY = 'kaiwa.vocab.v1';

function loadLegacy(): SavedWord[] | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as SavedWord[]) : null;
  } catch {
    return null;
  }
}

export interface SavedVocab {
  words: SavedWord[];
  has: (lemma: string) => boolean;
  save: (word: SavedWord) => void;
  remove: (lemma: string) => void;
}

/**
 * Quick vocab save, persisted to the backend document store (brief §7). The
 * data model is kept clean (lemma/surface/reading/glosses) so it could later be
 * exported or synced.
 */
export function useSavedVocab(): SavedVocab {
  const [words, setWords] = usePersistedState<SavedWord[]>('vocab', loadLegacy, []);

  const has = useCallback((lemma: string) => words.some((w) => w.lemma === lemma), [words]);

  const save = useCallback(
    (word: SavedWord) => {
      setWords((prev) => (prev.some((w) => w.lemma === word.lemma) ? prev : [word, ...prev]));
    },
    [setWords],
  );

  const remove = useCallback(
    (lemma: string) => {
      setWords((prev) => prev.filter((w) => w.lemma !== lemma));
    },
    [setWords],
  );

  return { words, has, save, remove };
}
