import { useCallback } from 'react';

import type { SavedConversation } from '../types/history';
import { usePersistedState } from './usePersistedState';

/** Old localStorage key, read once to migrate existing data to the backend. */
const LEGACY_KEY = 'kaiwa.conversations.v1';
const MAX_CONVERSATIONS = 50;

function loadLegacy(): SavedConversation[] | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as SavedConversation[]) : null;
  } catch {
    return null;
  }
}

export interface SavedConversations {
  conversations: SavedConversation[];
  save: (conversation: SavedConversation) => void;
  remove: (id: string) => void;
}

/**
 * Conversation history persisted to the backend document store. Upserts by id so
 * in-progress conversations auto-save without creating duplicates. Capped at 50
 * entries.
 */
export function useSavedConversations(): SavedConversations {
  const [conversations, setConversations] = usePersistedState<SavedConversation[]>(
    'conversations',
    loadLegacy,
    [],
  );

  const save = useCallback(
    (conversation: SavedConversation) => {
      setConversations((prev) => {
        const without = prev.filter((c) => c.id !== conversation.id);
        return [conversation, ...without].slice(0, MAX_CONVERSATIONS);
      });
    },
    [setConversations],
  );

  const remove = useCallback(
    (id: string) => {
      setConversations((prev) => prev.filter((c) => c.id !== id));
    },
    [setConversations],
  );

  return { conversations, save, remove };
}
