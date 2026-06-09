import { useEffect, useRef, useState } from 'react';

import type { Token } from '../../types/reading';
import { WordPopover } from './WordPopover';

interface TokenizedTextProps {
  tokens: Token[];
  showFurigana: boolean;
}

/**
 * Renders a tokenised reply: furigana over kanji (when enabled) and a
 * hover/focus dictionary popover on content words (brief §6–7). Only one
 * popover is open at a time; a short close delay lets the pointer travel from
 * the token into the popover without it vanishing.
 */
export function TokenizedText({ tokens, showFurigana }: TokenizedTextProps) {
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

  return (
    <p className="jp-text jp-ruby whitespace-pre-wrap break-words text-[1.05rem]">
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
            className={`cursor-help rounded transition-colors hover:bg-white/10 focus:outline-none focus-visible:bg-white/10 ${
              active?.index === index ? 'bg-white/10' : ''
            }`}
          >
            <TokenSurface token={token} showFurigana={showFurigana} />
          </span>
        ) : (
          <TokenSurface key={index} token={token} showFurigana={showFurigana} />
        ),
      )}

      {active && (
        <WordPopover
          token={tokens[active.index]}
          anchor={active.anchor}
          onPointerEnter={cancelClose}
          onPointerLeave={scheduleClose}
        />
      )}
    </p>
  );
}

/** A token's surface, with furigana over kanji runs when enabled. */
function TokenSurface({ token, showFurigana }: { token: Token; showFurigana: boolean }) {
  return (
    <>
      {token.furigana.map((segment, i) =>
        segment.ruby && showFurigana ? (
          <ruby key={i}>
            {segment.text}
            <rt>{segment.ruby}</rt>
          </ruby>
        ) : (
          <span key={i}>{segment.text}</span>
        ),
      )}
    </>
  );
}
