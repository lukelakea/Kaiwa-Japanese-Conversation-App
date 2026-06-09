import { createContext, useContext } from 'react';

import type { SavedGrammarStore } from '../hooks/useSavedGrammar';

/**
 * Shares the saved-grammar store between the save button (inside a message's
 * feedback annotation) and the saved-items panel, without threading props
 * through the message tree. Consume with {@link useSavedGrammarContext}.
 */
export const SavedGrammarContext = createContext<SavedGrammarStore | null>(null);

export function useSavedGrammarContext(): SavedGrammarStore {
  const value = useContext(SavedGrammarContext);
  if (!value) {
    throw new Error('useSavedGrammarContext must be used within a SavedGrammarContext.Provider');
  }
  return value;
}
