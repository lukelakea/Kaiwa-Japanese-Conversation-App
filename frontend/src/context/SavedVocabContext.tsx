import { createContext, useContext } from 'react';

import type { SavedVocab } from '../hooks/useSavedVocab';

/**
 * Shares the saved-vocab store between the deeply-nested save button (inside a
 * hover popover) and the saved-vocab panel, without threading props through the
 * whole message tree. Consume the value with {@link useSavedVocabContext}.
 */
export const SavedVocabContext = createContext<SavedVocab | null>(null);

export function useSavedVocabContext(): SavedVocab {
  const value = useContext(SavedVocabContext);
  if (!value) {
    throw new Error('useSavedVocabContext must be used within a SavedVocabContext.Provider');
  }
  return value;
}
