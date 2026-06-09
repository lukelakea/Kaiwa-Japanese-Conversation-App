/**
 * Conversation domain types. These mirror the backend Pydantic models
 * (backend/app/models/conversation.py) — keep the two in sync.
 */

import type { Token } from './reading';

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

/** Whether an assistant reply's English translation is loading or failed. */
export type TranslationStatus = 'loading' | 'error';

/** A message as rendered in the UI (carries a client-side id for React keys). */
export interface Message {
  id: string;
  role: Role;
  content: string;
  /** Tokenised form of an assistant reply, attached once streaming completes. */
  tokens?: Token[];
  /** English translation of an assistant reply, fetched on demand (brief §6). */
  translation?: string;
  translationStatus?: TranslationStatus;
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
