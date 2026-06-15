import type { ConversationSettings, Scenario } from './conversation';

/** A user-designed scenario saved for reuse, with its own settings preset. */
export interface SavedScenario extends Scenario {
  id: string;
  settings: ConversationSettings;
  savedAt: string;
}
