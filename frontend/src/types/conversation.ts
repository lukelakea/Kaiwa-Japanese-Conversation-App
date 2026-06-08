/**
 * Conversation domain types. These mirror the backend Pydantic models
 * (backend/app/models/conversation.py) — keep the two in sync.
 */

export type Role = 'user' | 'assistant';

export type Difficulty = 'beginner' | 'intermediate' | 'advanced' | 'near_fluent';
export type Formality = 'casual' | 'friendly' | 'polite' | 'formal';
export type Initiative = 'ai_led' | 'balanced' | 'user_led';
export type ConversationMode = 'free_talk' | 'scenario' | 'generated';

export interface ConversationSettings {
  difficulty: Difficulty;
  formality: Formality;
  initiative: Initiative;
}

/** A message as rendered in the UI (carries a client-side id for React keys). */
export interface Message {
  id: string;
  role: Role;
  content: string;
}

/** The wire-format message the backend expects (no id). */
export interface WireMessage {
  role: Role;
  content: string;
}

export interface ChatRequest {
  messages: WireMessage[];
  settings: ConversationSettings;
  mode: ConversationMode;
}
