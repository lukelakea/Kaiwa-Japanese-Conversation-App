import { useCallback, useEffect, useState } from 'react';

import type { SavedConversation } from '../types/history';

const STORAGE_KEY = 'kaiwa.conversations.v1';
const MAX_CONVERSATIONS = 50;

function load(): SavedConversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as SavedConversation[]) : [];
  } catch {
    return [];
  }
}

export interface SavedConversations {
  conversations: SavedConversation[];
  save: (conversation: SavedConversation) => void;
  remove: (id: string) => void;
}

/**
 * Conversation history backed by localStorage. Upserts by id so in-progress
 * conversations auto-save without creating duplicates. Capped at 50 entries.
 */
export function useSavedConversations(): SavedConversations {
  const [conversations, setConversations] = useState<SavedConversation[]>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  }, [conversations]);

  const save = useCallback((conversation: SavedConversation) => {
    setConversations((prev) => {
      const without = prev.filter((c) => c.id !== conversation.id);
      return [conversation, ...without].slice(0, MAX_CONVERSATIONS);
    });
  }, []);

  const remove = useCallback((id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
  }, []);

  return { conversations, save, remove };
}
