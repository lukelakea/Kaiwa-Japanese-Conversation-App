import { AnimatePresence } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toRomaji } from 'wanakana';

import type { GrammarMatch, Token } from '../../types/reading';
import type { TextSize } from '../../types/settings';
import { TEXT_SIZE_CLASS } from '../../types/settings';
import { findInflectionChains, indexInflectionChains } from './inflectionChains';
import { WordPopover } from './WordPopover';

/** Smallest rect containing all of `rects`. */
function unionRect(rects: DOMRect[]): DOMRect {
  const left = Math.min(...rects.map((r) => r.left));
  const top = Math.min(...rects.map((r) => r.top));
  const right = Math.max(...rects.map((r) => r.right));
  const bottom = Math.max(...rects.map((r) => r.bottom));
  return new DOMRect(left, top, right - left, bottom - top);
}

interface TokenizedTextProps {
  tokens: Token[];
  /** Constructions detected over `tokens`; hovering any member token shows its card. */
  grammar?: GrammarMatch[];
  showFurigana: boolean;
  showRomaji: boolean;
  textSize: TextSize;
  isUser?: boolean;
  /** Index of the token currently being spoken by TTS, if any (Phase 5). */
  activeTokenIndex?: number | null;
  /** Called when a token is clicked, to play back its pronunciation (Phase 5). */
  onTokenClick?: (index: number) => void;
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
  activeTokenIndex = null,
  onTokenClick,
}: TokenizedTextProps) {
  const [active, setActive] = useState<{ index: number; anchor: DOMRect; chainKey: number } | null>(
    null,
  );
  const closeTimer = useRef<number | null>(null);
  const tokenRefs = useRef<Map<number, HTMLElement>>(new Map());

  // Inflection chains (e.g. あり+まし+た for ありました): a content word plus
  // its trailing auxiliaries, shown as one popover instead of one per token.
  const chainByToken = useMemo(() => indexInflectionChains(findInflectionChains(tokens)), [tokens]);

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
  const activeChain = active ? chainByToken.get(active.index) : undefined;
  // Every token participating in a construction or inflection chain with the
  // hovered token.
  const highlighted = useMemo(() => {
    const set = new Set(activeMatches.flatMap((m) => m.tokenIndices));
    if (activeChain) {
      for (let i = activeChain.start; i <= activeChain.end; i++) set.add(i);
    }
    return set;
  }, [activeMatches, activeChain]);

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
    const chain = chainByToken.get(index);
    let anchor = el.getBoundingClientRect();
    if (chain) {
      const rects: DOMRect[] = [];
      for (let i = chain.start; i <= chain.end; i++) {
        const member = tokenRefs.current.get(i);
        if (member) rects.push(member.getBoundingClientRect());
      }
      if (rects.length) anchor = unionRect(rects);
    }
    setActive({ index, anchor, chainKey: chain ? chain.start : index });
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
            ref={(el) => {
              if (el) tokenRefs.current.set(index, el);
              else tokenRefs.current.delete(index);
            }}
            role="button"
            tabIndex={0}
            onPointerEnter={(e) => open(index, e.currentTarget)}
            onPointerLeave={scheduleClose}
            onFocus={(e) => open(index, e.currentTarget)}
            onBlur={scheduleClose}
            onClick={() => onTokenClick?.(index)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onTokenClick?.(index);
              }
            }}
            className={`inline-block cursor-pointer rounded transition-colors focus:outline-none ${tokenClass(index)}`}
          >
            <TokenSurface
              token={token}
              showFurigana={showFurigana}
              showRomaji={showRomaji}
              isUser={isUser}
              isSpeaking={activeTokenIndex === index}
            />
          </span>
        ) : (
          <TokenSurface
            key={index}
            token={token}
            showFurigana={showFurigana}
            showRomaji={showRomaji}
            isUser={isUser}
            isSpeaking={activeTokenIndex === index}
          />
        ),
      )}

      <AnimatePresence>
        {active && (
          <WordPopover
            key={active.chainKey}
            token={activeChain ? tokens[activeChain.start] : tokens[active.index]}
            tokens={tokens}
            matches={activeMatches}
            activeIndex={active.index}
            chain={activeChain}
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
  isUser,
  isSpeaking = false,
}: {
  token: Token;
  showFurigana: boolean;
  showRomaji: boolean;
  isUser: boolean;
  isSpeaking?: boolean;
}) {
  const onAccent = isUser ? 'on-accent' : '';
  // Highlight only the base text, not the furigana/romaji ruby annotations.
  const speakingClass = isSpeaking ? 'rounded bg-accent-500/30' : '';
  const segments = token.furigana.map((segment, i) =>
    segment.ruby && showFurigana ? (
      <ruby key={i} className={onAccent}>
        <span className={speakingClass}>{segment.text}</span>
        <rt>{segment.ruby}</rt>
      </ruby>
    ) : (
      <span key={i} className={speakingClass}>
        {segment.text}
      </span>
    ),
  );

  if (showRomaji) {
    return (
      <span className="inline-block">
        <ruby className={`romaji-ruby ${onAccent}`}>
          {segments}
          <rt>{toRomaji(token.reading)}</rt>
        </ruby>
      </span>
    );
  }

  return <>{segments}</>;
}
