import { describe, expect, it } from 'vitest';

import type { MoraTiming, Token } from '../../types/reading';
import { activeTokenAt, alignMorasToTokens } from './alignTiming';

function token(surface: string, reading: string, pos = 'noun'): Token {
  return {
    surface,
    lemma: surface,
    reading,
    pos,
    interactive: true,
    furigana: [{ text: surface, ruby: null }],
    conjugationForm: null,
    conjugationType: null,
  };
}

function mora(text: string, start: number, end: number): MoraTiming {
  return { text, start, end };
}

describe('alignMorasToTokens', () => {
  it('maps each token to the time range of its moras', () => {
    const tokens = [token('元気', 'げんき'), token('です', 'です')];
    const moras = [
      mora('げ', 0, 0.1),
      mora('ん', 0.1, 0.2),
      mora('き', 0.2, 0.3),
      mora('で', 0.3, 0.4),
      mora('す', 0.4, 0.5),
    ];

    expect(alignMorasToTokens(tokens, moras)).toEqual([
      { start: 0, end: 0.3 },
      { start: 0.3, end: 0.5 },
    ]);
  });

  it('skips symbols and whitespace, which are not voiced', () => {
    const tokens = [
      token('元気', 'げんき'),
      token('！', '!', 'symbol'),
      token(' ', 'きごう', 'whitespace'),
      token('です', 'です'),
    ];
    const moras = [
      mora('げ', 0, 0.1),
      mora('ん', 0.1, 0.2),
      mora('き', 0.2, 0.3),
      mora('で', 0.3, 0.4),
      mora('す', 0.4, 0.5),
    ];

    const timings = alignMorasToTokens(tokens, moras);
    expect(timings[0]).toEqual({ start: 0, end: 0.3 });
    expect(timings[1]).toBeNull();
    expect(timings[2]).toBeNull();
    expect(timings[3]).toEqual({ start: 0.3, end: 0.5 });
  });

  it('handles multi-character mora text (e.g. digraphs)', () => {
    const tokens = [token('今日', 'きょう')];
    const moras = [mora('きょ', 0, 0.15), mora('う', 0.15, 0.25)];

    expect(alignMorasToTokens(tokens, moras)).toEqual([{ start: 0, end: 0.25 }]);
  });

  it('returns null for trailing tokens once moras are exhausted', () => {
    const tokens = [token('元気', 'げんき'), token('です', 'です')];
    const moras = [mora('げ', 0, 0.1), mora('ん', 0.1, 0.2), mora('き', 0.2, 0.3)];

    const timings = alignMorasToTokens(tokens, moras);
    expect(timings[0]).toEqual({ start: 0, end: 0.3 });
    expect(timings[1]).toBeNull();
  });
});

describe('activeTokenAt', () => {
  const timings = [
    { start: 0, end: 0.3 },
    null,
    { start: 0.3, end: 0.5 },
  ];

  it('finds the token whose range contains the given time', () => {
    expect(activeTokenAt(timings, 0.1)).toBe(0);
    expect(activeTokenAt(timings, 0.4)).toBe(2);
  });

  it('returns null when no range contains the time', () => {
    expect(activeTokenAt(timings, 0.6)).toBeNull();
  });
});
