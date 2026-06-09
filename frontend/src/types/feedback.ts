/**
 * Feedback domain types (Phase 3). These mirror the backend Pydantic models in
 * backend/app/models/feedback.py — keep the two in sync.
 */

/** Soft, non-exclusive tags for a correction (brief §8). */
export type FeedbackLabel = 'grammar' | 'vocabulary' | 'phrasing' | 'naturalness';

/** A critique of one user message, rendered as a collapsible annotation. */
export interface Feedback {
  /** Whether the message is already natural and correct for the register. */
  acceptable: boolean;
  labels: FeedbackLabel[];
  /** The corrected, natural Japanese — null when the message is acceptable. */
  correction: string | null;
  /** English confirmation, or what to change and why (brief §8). */
  explanation: string;
}

/** Whether a message's feedback is loading or failed. */
export type FeedbackStatus = 'loading' | 'error';

/**
 * A grammar point saved to the personal log (brief §7): the user's original
 * sentence plus the correction that triggered the save. Persisted in
 * localStorage; kept deliberately simple — a log, not a grammar encyclopedia.
 */
export interface SavedGrammar {
  id: string;
  /** The user's original sentence. */
  original: string;
  /** The corrected Japanese. */
  correction: string;
  /** The English explanation from the feedback. */
  explanation: string;
  savedAt: number;
}
