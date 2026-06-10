import { AnimatePresence } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toRomaji } from 'wanakana';

import type { GrammarMatch, Token } from '../../types/reading';
import type { TextSize } from '../../types/settings';
import { TEXT_SIZE_CLASS } from '../../types/settings';
import { WordPopover } from './WordPopover';

interface TokenizedTextProps {
  tokens: Token[];
  /** Constructions detected over `tokens`; hovering any member token shows its card. */
  grammar?: GrammarMatch[];
  showFurigana: boolean;
  showRomaji: boolean;
  textSize: TextSize;
  isUser?: boolean;
}

/**
 * Renders a tokenised reply: furigana over kanji (when enabled) and a
 * hover/focus dictionary popover on content words (brief §6–7). Only one
 * popover is open at a time; a short close delay lets the pointer travel from
 * the token into the popover without it vanishing. When the hovered token is
 * part of a grammatical construction, every member token is highlighted so the
 * learner sees the construction's full extent.
 */
export function TokenizedText({
  tokens,
  grammar,
  showFurigana,
  showRomaji,
  textSize,
  isUser = false,
}: TokenizedTextProps) {
  const [active, setActive] = useState<{ index: number; anchor: DOMRect } | null>(null);
  const closeTimer = useRef<number | null>(null);

  // Per-token view of the detected constructions: index → matches it belongs
  // to, widest span first so the popover leads with the most informative card.
  const matchesByToken = useMemo(() => {
    const map = new Map<number, GrammarMatch[]>();
    for (const match of grammar ?? []) {
      for (const index of match.tokenIndices) {
        const list = map.get(index);
        if (list) list.push(match);
        else map.set(index, [match]);
      }
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          b.tokenIndices[b.tokenIndices.length - 1] -
          b.tokenIndices[0] -
          (a.tokenIndices[a.tokenIndices.length - 1] - a.tokenIndices[0]),
      );
    }
    return map;
  }, [grammar]);

  const activeMatches = useMemo(
    () => (active ? (matchesByToken.get(active.index) ?? []) : []),
    [active, matchesByToken],
  );
  // Every token participating in a construction with the hovered token.
  const highlighted = useMemo(
    () => new Set(activeMatches.flatMap((m) => m.tokenIndices)),
    [activeMatches],
  );

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

  const tokenClass = (index: number): string => {
    const isActive = active?.index === index;
    const isMember = !isActive && highlighted.has(index);
    if (isUser) {
      if (isActive) return 'bg-white/25 text-white';
      if (isMember) return 'bg-white/15';
      return 'hover:bg-white/20 focus-visible:bg-white/20';
    }
    if (isActive) return 'bg-accent-500/15 text-accent-400';
    if (isMember) return 'bg-accent-500/10';
    return 'hover:bg-white/10 hover:text-accent-400 focus-visible:bg-white/10';
  };

  return (
    <p
      className={`jp-text jp-ruby whitespace-pre-wrap break-words ${TEXT_SIZE_CLASS[textSize]} ${rubySpacingClass}`}
    >
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
            className={`cursor-help rounded transition-colors focus:outline-none ${tokenClass(index)}`}
          >
            <TokenSurface token={token} showFurigana={showFurigana} showRomaji={showRomaji} />
          </span>
        ) : (
          <TokenSurface
            key={index}
            token={token}
            showFurigana={showFurigana}
            showRomaji={showRomaji}
          />
        ),
      )}

      <AnimatePresence>
        {active && (
          <WordPopover
            key={active.index}
            token={tokens[active.index]}
            tokens={tokens}
            matches={activeMatches}
            activeIndex={active.index}
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
