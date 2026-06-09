import { AnimatePresence } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { toRomaji } from 'wanakana';

import type { Token } from '../../types/reading';
import type { TextSize } from '../../types/settings';
import { TEXT_SIZE_CLASS } from '../../types/settings';
import { WordPopover } from './WordPopover';

interface TokenizedTextProps {
  tokens: Token[];
  showFurigana: boolean;
  showRomaji: boolean;
  textSize: TextSize;
}

/**
 * Renders a tokenised reply: furigana over kanji (when enabled) and a
 * hover/focus dictionary popover on content words (brief §6–7). Only one
 * popover is open at a time; a short close delay lets the pointer travel from
 * the token into the popover without it vanishing.
 */
export function TokenizedText({ tokens, showFurigana, showRomaji, textSize }: TokenizedTextProps) {
  const [active, setActive] = useState<{ index: number; anchor: DOMRect } | null>(null);
  const closeTimer = useRef<number | null>(null);

  const cancelClose = () => {
    if (closeTimer.current !== null) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setActive(null), 140);
  };
  const open = (index: number, el: HTMLElement) => {
    cancelClose();
    setActive({ index, anchor: el.getBoundingClientRect() });
  };

  useEffect(() => cancelClose, []);

  const rubySpacingClass =
    showRomaji && showFurigana ? 'jp-ruby-both' : showRomaji ? 'jp-ruby-romaji' : '';

  return (
    <p className={`jp-text jp-ruby whitespace-pre-wrap break-words ${TEXT_SIZE_CLASS[textSize]} ${rubySpacingClass}`}>
      {tokens.map((token, index) =>
        token.interactive ? (
          <span
            key={index}
            role="button"
            tabIndex={0}
            onPointerEnter={(e) => open(index, e.currentTarget)}
            onPointerLeave={scheduleClose}
            onFocus={(e) => open(index, e.currentTarget)}
            onBlur={scheduleClose}
            className={`cursor-help rounded transition-colors hover:text-accent-400 focus:outline-none ${
              active?.index === index
                ? 'bg-accent-500/15 text-accent-400'
                : 'hover:bg-white/10 focus-visible:bg-white/10'
            }`}
          >
            <TokenSurface token={token} showFurigana={showFurigana} showRomaji={showRomaji} />
          </span>
        ) : (
          <TokenSurface key={index} token={token} showFurigana={showFurigana} showRomaji={showRomaji} />
        ),
      )}

      <AnimatePresence>
        {active && (
          <WordPopover
            key={active.index}
            token={tokens[active.index]}
            anchor={active.anchor}
            onPointerEnter={cancelClose}
            onPointerLeave={scheduleClose}
          />
        )}
      </AnimatePresence>
    </p>
  );
}

/** A token's surface, with furigana over kanji runs when enabled, and/or romaji below. */
function TokenSurface({
  token,
  showFurigana,
  showRomaji,
}: {
  token: Token;
  showFurigana: boolean;
  showRomaji: boolean;
}) {
  const segments = token.furigana.map((segment, i) =>
    segment.ruby && showFurigana ? (
      <ruby key={i}>
        {segment.text}
        <rt>{segment.ruby}</rt>
      </ruby>
    ) : (
      <span key={i}>{segment.text}</span>
    ),
  );

  if (showRomaji) {
    return (
      <ruby className="romaji-ruby">
        {segments}
        <rt>{toRomaji(token.reading)}</rt>
      </ruby>
    );
  }

  return <>{segments}</>;
}
