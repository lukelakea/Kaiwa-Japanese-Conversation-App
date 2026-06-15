/**
 * Conversation domain types. These mirror the backend Pydantic models
 * (backend/app/models/conversation.py) — keep the two in sync.
 */

import type { Feedback, FeedbackStatus } from './feedback';
import type { GrammarMatch, Token } from './reading';

export type Role = 'user' | 'assistant';

export type Difficulty = 'beginner' | 'intermediate' | 'advanced' | 'near_fluent';
export type Formality = 'casual' | 'friendly' | 'polite' | 'formal';
export type Initiative = 'ai_led' | 'balanced' | 'user_led';
export type ConversationMode = 'free_talk' | 'scenario' | 'generated';

/** A conversation scenario — curated, LLM-generated, or user-designed (brief §5). */
export interface Scenario {
  title: string;
  title_ja: string;
  description: string;
  user_role: string;
  ai_role: string;
  /** Free-form instructions for the AI to keep in mind for this conversation. */
  notes?: string;
  /** Optional objective the learner is working towards in this conversation. */
  goal?: string;
}

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
  /** Grammatical constructions detected over `tokens`, attached with them. */
  grammar?: GrammarMatch[];
  /** English translation of this message's content, fetched on demand (brief §6). */
  translation?: string;
  translationStatus?: TranslationStatus;
  /** Critique of a user message, fetched in parallel with the reply (brief §8). */
  feedback?: Feedback;
  feedbackStatus?: FeedbackStatus;
  /** English translation of `feedback.correction`, fetched on demand. */
  correctionTranslation?: string;
  correctionTranslationStatus?: TranslationStatus;
  /** True for messages loaded from saved history — suppresses auto-play. */
  fromHistory?: true;
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
  scenario?: Scenario;
}
