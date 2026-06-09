import { useCallback, useEffect, useState } from 'react';

import type { SavedWord } from '../types/reading';

const STORAGE_KEY = 'kaiwa.vocab.v1';

function load(): SavedWord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as SavedWord[]) : [];
  } catch {
    return [];
  }
}

export interface SavedVocab {
  words: SavedWord[];
  has: (lemma: string) => boolean;
  save: (word: SavedWord) => void;
  remove: (lemma: string) => void;
}

/**
 * Quick vocab save backed by localStorage (brief §7). The data model is kept
 * deliberately clean (lemma/surface/reading/glosses) so it could later be
 * exported or synced — but only localStorage is built now.
 */
export function useSavedVocab(): SavedVocab {
  const [words, setWords] = useState<SavedWord[]>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
  }, [words]);

  const has = useCallback((lemma: string) => words.some((w) => w.lemma === lemma), [words]);

  const save = useCallback((word: SavedWord) => {
    setWords((prev) => (prev.some((w) => w.lemma === word.lemma) ? prev : [word, ...prev]));
  }, []);

  const remove = useCallback((lemma: string) => {
    setWords((prev) => prev.filter((w) => w.lemma !== lemma));
  }, []);

  return { words, has, save, remove };
}
