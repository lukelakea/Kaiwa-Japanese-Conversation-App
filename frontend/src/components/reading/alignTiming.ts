import type { MoraTiming, Token } from '../../types/reading';

/** A token's time range (seconds) within the synthesised audio. */
export interface TokenTiming {
  start: number;
  end: number;
}

/**
 * Map each token's hiragana reading onto VOICEVOX's mora timeline, so the UI
 * can highlight the token currently being spoken (Phase 5).
 *
 * Both sequences are walked in lockstep by reading character: tokens with no
 * reading (punctuation, whitespace) get `null`. Pronunciation can drift
 * slightly from kuromoji's reading (e.g. small-tsu handling), so this is a
 * best-effort alignment, not an exact match.
 */
export function alignMorasToTokens(
  tokens: Token[],
  moras: MoraTiming[],
): (TokenTiming | null)[] {
  const result: (TokenTiming | null)[] = [];
  let moraIndex = 0;
  let charOffset = 0;

  for (const token of tokens) {
    // Symbols (punctuation) and whitespace aren't voiced, but kuromoji still
    // gives them a "reading" (e.g. "。" → "。", a space → "きごう") that would
    // throw off the character alignment below — skip them entirely.
    const reading = token.pos === 'symbol' || token.pos === 'whitespace' ? '' : token.reading;
    let remaining = reading.length;
    if (remaining === 0 || moraIndex >= moras.length) {
      result.push(null);
      continue;
    }

    let start: number | null = null;
    let end = 0;
    while (remaining > 0 && moraIndex < moras.length) {
      const mora = moras[moraIndex];
      const available = mora.text.length - charOffset;
      const take = Math.min(remaining, available);
      if (start === null) start = mora.start;
      end = mora.end;
      remaining -= take;
      charOffset += take;
      if (charOffset >= mora.text.length) {
        moraIndex += 1;
        charOffset = 0;
      }
    }
    result.push(start !== null ? { start, end } : null);
  }

  return result;
}

/** Index of the token whose time range contains `time`, or null if none does. */
export function activeTokenAt(timings: (TokenTiming | null)[], time: number): number | null {
  for (let i = 0; i < timings.length; i++) {
    const timing = timings[i];
    if (timing && time >= timing.start && time < timing.end) return i;
  }
  return null;
}
