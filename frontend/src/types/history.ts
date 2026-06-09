import type { ConversationMode, ConversationSettings, Message, Scenario } from './conversation';

export interface SavedConversation {
  id: string;
  title: string;
  messages: Message[];
  settings: ConversationSettings;
  mode: ConversationMode;
  scenario: Scenario | null;
  createdAt: string;
  updatedAt: string;
}
