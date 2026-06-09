/**
 * Reading-aid domain types (Phase 2). These mirror the backend Pydantic models
 * in backend/app/models/reading.py — keep the two in sync.
 */

/** A run of a token's surface, optionally annotated with a furigana reading. */
export interface FuriganaSegment {
  text: string;
  /** Hiragana reading for `text`, or null when `text` is kana needing none. */
  ruby: string | null;
}

/** One morpheme of a tokenised reply. */
export interface Token {
  surface: string;
  lemma: string;
  reading: string;
  pos: string;
  /** Worth hovering/saving (a content word or kanji) vs. a particle/symbol. */
  interactive: boolean;
  furigana: FuriganaSegment[];
}

export interface WordSense {
  partOfSpeech: string[];
  glosses: string[];
}

/** A JMdict dictionary entry, trimmed for hover display. */
export interface WordEntry {
  text: string;
  reading: string;
  senses: WordSense[];
}

/** A KANJIDIC2 entry for a single character. */
export interface KanjiEntry {
  literal: string;
  on: string[];
  kun: string[];
  meanings: string[];
  strokes: number | null;
  grade: number | null;
  jlpt: number | null;
}

/** Hover-lookup result for one token: matching words and its kanji. */
export interface LookupResult {
  words: WordEntry[];
  kanji: KanjiEntry[];
}

/** A word saved to the personal vocab list (persisted in localStorage). */
export interface SavedWord {
  /** Stable identity — the dictionary form. */
  lemma: string;
  surface: string;
  reading: string;
  glosses: string[];
  savedAt: number;
}
