import { describe, expect, it } from 'vitest';

import type { Token } from '../../types/reading';
import { findInflectionChains, indexInflectionChains } from './inflectionChains';

function token(surface: string, lemma: string, pos: string): Token {
  return {
    surface,
    lemma,
    reading: surface,
    pos,
    interactive: true,
    furigana: [{ text: surface, ruby: null }],
    conjugationForm: null,
    conjugationType: null,
  };
}

describe('findInflectionChains', () => {
  it('groups a verb with its trailing polite-past auxiliaries (ありました)', () => {
    const tokens = [
      token('あり', 'ある', 'verb'),
      token('まし', 'ます', 'auxiliary'),
      token('た', 'た', 'auxiliary'),
    ];

    const chains = findInflectionChains(tokens);

    expect(chains).toEqual([{ start: 0, end: 2, tags: ['polite', 'past'] }]);
  });

  it('does not group a content word with no recognized auxiliary tail', () => {
    const tokens = [token('猫', '猫', 'noun'), token('が', 'が', 'particle')];

    expect(findInflectionChains(tokens)).toEqual([]);
  });

  it('does not group an auxiliary onto a non-content-word head', () => {
    const tokens = [token('が', 'が', 'particle'), token('まし', 'ます', 'auxiliary')];

    expect(findInflectionChains(tokens)).toEqual([]);
  });

  it('stops the chain at the first auxiliary without a tag', () => {
    const tokens = [
      token('食べ', '食べる', 'verb'),
      token('ます', 'ます', 'auxiliary'),
      token('？', '？', 'symbol'),
    ];

    const chains = findInflectionChains(tokens);

    expect(chains).toEqual([{ start: 0, end: 1, tags: ['polite'] }]);
  });
});

describe('indexInflectionChains', () => {
  it('maps every member index to its chain', () => {
    const chain = { start: 1, end: 3, tags: ['polite', 'past'] };
    const map = indexInflectionChains([chain]);

    expect(map.get(1)).toBe(chain);
    expect(map.get(2)).toBe(chain);
    expect(map.get(3)).toBe(chain);
    expect(map.has(0)).toBe(false);
    expect(map.has(4)).toBe(false);
  });
});
