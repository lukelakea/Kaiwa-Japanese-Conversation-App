import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Token } from '../../types/reading';
import { TokenizedText } from './TokenizedText';

function token(surface: string, ruby: string | null = null): Token {
  return {
    surface,
    lemma: surface,
    reading: surface,
    pos: 'noun',
    interactive: true,
    furigana: [{ text: surface, ruby }],
    conjugationForm: null,
    conjugationType: null,
  };
}

describe('TokenizedText speaking highlight', () => {
  it('highlights only the base text, not the furigana ruby annotation', () => {
    const tokens = [token('元気', 'げんき'), token('です')];
    const { container } = render(
      <TokenizedText
        tokens={tokens}
        showFurigana
        showRomaji={false}
        textSize="md"
        activeTokenIndex={0}
      />,
    );

    const rubies = container.querySelectorAll('ruby');
    const activeRuby = [...rubies].find((r) => r.textContent?.startsWith('元気'));
    expect(activeRuby).toBeTruthy();

    const highlighted = activeRuby!.querySelector('.bg-accent-500\\/30');
    expect(highlighted?.textContent).toBe('元気');

    // The furigana <rt> itself must not carry the highlight.
    const rt = activeRuby!.querySelector('rt');
    expect(rt?.className).not.toContain('bg-accent-500/30');
  });

  it('highlights only the base text, not the romaji ruby annotation', () => {
    const tokens = [token('元気', 'げんき')];
    const { container } = render(
      <TokenizedText
        tokens={tokens}
        showFurigana={false}
        showRomaji
        textSize="md"
        activeTokenIndex={0}
      />,
    );

    const romajiRuby = container.querySelector('ruby.romaji-ruby');
    expect(romajiRuby).toBeTruthy();

    const highlighted = romajiRuby!.querySelector('.bg-accent-500\\/30');
    expect(highlighted?.textContent).toBe('元気');

    const rt = romajiRuby!.querySelector('rt');
    expect(rt?.className).not.toContain('bg-accent-500/30');
  });

  it('does not highlight tokens other than activeTokenIndex', () => {
    const tokens = [token('元気'), token('です')];
    const { container } = render(
      <TokenizedText
        tokens={tokens}
        showFurigana={false}
        showRomaji={false}
        textSize="md"
        activeTokenIndex={0}
      />,
    );

    const highlighted = container.querySelectorAll('.bg-accent-500\\/30');
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0].textContent).toBe('元気');
  });
});
