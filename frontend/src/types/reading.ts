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
  interactive: boolean;
  furigana: FuriganaSegment[];
  /** English label for the inflected form, e.g. "conjunctive" or "past form". Null when surface equals lemma. */
  conjugationForm: string | null;
  /** English label for the conjugation class, e.g. "godan" or "ichidan". Null for uninflecting words. */
  conjugationType: string | null;
}

/**
 * A grammatical construction detected across one or more tokens (〜ている,
 * 〜てしまう, …). `tokenIndices` lists every participating token — not
 * necessarily contiguous (e.g. 〜ば〜ほど) — so hovering any member token shows
 * the same construction card.
 */
export interface GrammarMatch {
  patternId: string;
  name: string;
  gloss: string;
  explanation: string;
  tokenIndices: number[];
}

/** The full result of tokenising a reply: tokens plus detected constructions. */
export interface TokenizedReading {
  tokens: Token[];
  grammar: GrammarMatch[];
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
