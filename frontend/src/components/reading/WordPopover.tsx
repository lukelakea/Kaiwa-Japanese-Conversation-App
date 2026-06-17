import { motion } from 'motion/react';
import { createPortal } from 'react-dom';

import { popVariants } from '../../config/motion';
import { useSavedVocabContext } from '../../context/SavedVocabContext';
import { useTokenLookup } from '../../hooks/useTokenLookup';
import type { GrammarMatch, KanjiEntry, SavedWord, Token, WordEntry } from '../../types/reading';
import { BookmarkIcon } from '../ui/icons';
import type { InflectionChain } from './inflectionChains';

const POPOVER_WIDTH = 320;
// Approximate height used to decide whether to flip above the token.
const FLIP_THRESHOLD = 260;

interface WordPopoverProps {
  /** The chain's head token (e.g. ある for ありました), or the hovered token
   * itself when it isn't part of a chain. Dictionary lookup and save use this. */
  token: Token;
  /** The full token stream, used to render each construction's span. */
  tokens: Token[];
  /** Constructions the hovered token participates in, widest first. */
  matches: GrammarMatch[];
  /** Index of the hovered token, emphasised within each construction span. */
  activeIndex: number;
  /** When the hovered token is part of an inflection chain (e.g. あり/まし/た),
   * the chain's span and derived tags — the whole chain shares one popover. */
  chain?: InflectionChain;
  /** Viewport rect of the hovered token, used to position the popover. */
  anchor: DOMRect;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}

/**
 * Floating dictionary card for a hovered token (brief §7): grammatical
 * constructions the token is part of, JMdict word senses, per-kanji detail,
 * and a one-click save. Rendered in a portal so it is never clipped by the
 * scrolling message list.
 */
export function WordPopover({
  token,
  tokens,
  matches,
  activeIndex,
  chain,
  anchor,
  onPointerEnter,
  onPointerLeave,
}: WordPopoverProps) {
  const { result, loading, error } = useTokenLookup(token, true);
  const { has, save, remove } = useSavedVocabContext();
  const saved = has(token.lemma);

  const flipUp = anchor.bottom > window.innerHeight - FLIP_THRESHOLD;
  const left = Math.max(8, Math.min(anchor.left + 16, window.innerWidth - POPOVER_WIDTH - 8));
  const style: React.CSSProperties = {
    width: POPOVER_WIDTH,
    left,
    ...(flipUp ? { bottom: window.innerHeight - anchor.top + 6 } : { top: anchor.bottom + 6 }),
  };

  // Invisible bridge that fills the gap between the token and the popover so
  // the pointer can travel diagonally without triggering the close timer.
  const bridgeLeft = Math.max(8, anchor.left);
  const bridgeStyle: React.CSSProperties = {
    position: 'fixed',
    left: bridgeLeft,
    width: left + POPOVER_WIDTH - bridgeLeft,
    zIndex: 49,
    ...(flipUp ? { top: anchor.top - 8, height: 8 } : { top: anchor.bottom, height: 8 }),
  };

  const toggleSave = () =>
    saved ? remove(token.lemma) : save(buildSavedWord(token, result?.words[0]));

  return createPortal(
    <>
      <div style={bridgeStyle} onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave} />
      <motion.div
      role="dialog"
      variants={popVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      className="fixed z-50 max-h-[60vh] overflow-y-auto rounded-xl border border-border bg-surface-3 p-3 text-sm shadow-lg"
      style={{ ...style, transformOrigin: flipUp ? 'bottom' : 'top' }}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          {chain ? (
            <span className="jp-text text-lg">
              {tokens.slice(chain.start, chain.end + 1).map((chainToken, offset) => {
                const tokenIndex = chain.start + offset;
                return (
                  <span
                    key={tokenIndex}
                    className={`rounded transition-colors duration-200 ${
                      tokenIndex === activeIndex
                        ? 'bg-accent-500/15 text-accent-400'
                        : 'text-zinc-400'
                    }`}
                  >
                    {chainToken.surface}
                  </span>
                );
              })}
            </span>
          ) : (
            <>
              <span className="jp-text text-lg text-accent-400">{token.surface}</span>
              {token.reading && token.reading !== token.surface && (
                <span className="jp-text ml-2 text-zinc-400">{token.reading}</span>
              )}
            </>
          )}
          {token.conjugationForm && (
            <p className="mt-0.5 text-xs italic text-zinc-500">
              {token.conjugationForm} of {token.lemma}
              {token.conjugationType && ` · ${token.conjugationType}`}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={toggleSave}
          aria-pressed={saved}
          title={saved ? 'Remove from saved words' : 'Save word'}
          className={`flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors ${
            saved
              ? 'border-accent-500/40 bg-accent-600/20 text-accent-400'
              : 'border-border text-zinc-400 hover:border-border-strong hover:text-zinc-200'
          }`}
        >
          <BookmarkIcon className="h-3.5 w-3.5" filled={saved} />
          {saved ? 'Saved' : 'Save'}
        </button>
      </div>

      {chain && result?.words[0] && (
        <div className="mb-3">
          <p className="jp-text text-sm text-zinc-300">
            {result.words[0].text}
            {result.words[0].reading && result.words[0].reading !== result.words[0].text && (
              <span className="ml-1.5 text-zinc-500">{result.words[0].reading}</span>
            )}
            {result.words[0].senses[0]?.glosses.length > 0 && (
              <span className="ml-2 text-xs text-zinc-400">
                — {result.words[0].senses[0].glosses.slice(0, 2).join('; ')}
              </span>
            )}
          </p>
          {chain.tags.length > 0 && (
            <div className="mt-1 flex gap-1">
              {chain.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-border px-2 py-0.5 text-xs text-zinc-400"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {matches.length > 0 && (
        <div className="mb-3 flex flex-col gap-2">
          {matches.map((match) => (
            <ConstructionCard
              key={`${match.patternId}-${match.tokenIndices[0]}`}
              match={match}
              tokens={tokens}
              activeIndex={activeIndex}
            />
          ))}
        </div>
      )}

      {loading && <p className="text-zinc-500">Looking up…</p>}
      {error && <p className="text-zinc-500">Couldn’t load the dictionary.</p>}
      {result && !loading && <DictionaryBody words={result.words} kanji={result.kanji} />}
    </motion.div>
    </>,
    document.body,
  );
}

/**
 * One detected grammatical construction: its name and gloss, the matched span
 * (hovered token emphasised, gaps in split patterns shown as …), and a short
 * explanation of why the pieces mean what they mean.
 */
function ConstructionCard({
  match,
  tokens,
  activeIndex,
}: {
  match: GrammarMatch;
  tokens: Token[];
  activeIndex: number;
}) {
  return (
    <div className="rounded-lg border border-accent-500/20 bg-accent-500/5 p-2">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="jp-text text-accent-400">{match.name}</span>
        <span className="text-xs text-zinc-300">{match.gloss}</span>
      </div>
      <div className="jp-text mt-0.5 text-sm text-zinc-200">
        {match.tokenIndices.map((tokenIndex, i) => (
          <span key={tokenIndex}>
            {i > 0 && tokenIndex !== match.tokenIndices[i - 1] + 1 && (
              <span className="text-zinc-600">…</span>
            )}
            <span className={tokenIndex === activeIndex ? 'text-accent-400' : undefined}>
              {tokens[tokenIndex].surface}
            </span>
          </span>
        ))}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-zinc-400">{match.explanation}</p>
    </div>
  );
}

function DictionaryBody({ words, kanji }: { words: WordEntry[]; kanji: KanjiEntry[] }) {
  if (words.length === 0 && kanji.length === 0) {
    return <p className="text-zinc-500">No dictionary entry found.</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {words.length > 0 && (
        <ul className="flex flex-col gap-2">
          {words.map((word, i) => (
            <li
              key={`${word.text}-${i}`}
              className="border-b border-white/5 pb-2 last:border-0 last:pb-0"
            >
              <div className="jp-text text-zinc-200">
                {word.text}
                {word.reading && word.reading !== word.text && (
                  <span className="ml-2 text-zinc-500">{word.reading}</span>
                )}
              </div>
              <ol className="mt-0.5 list-inside list-decimal text-zinc-300 marker:text-zinc-600">
                {word.senses.slice(0, 4).map((sense, j) => (
                  <li key={j}>
                    {sense.glosses.slice(0, 4).join('; ')}
                    {sense.partOfSpeech.length > 0 && (
                      <span className="ml-1 text-xs italic text-zinc-500">
                        ({sense.partOfSpeech[0]})
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ul>
      )}

      {kanji.length > 0 && (
        <ul className="flex flex-col gap-2">
          {kanji.map((entry) => (
            <li key={entry.literal} className="flex gap-3">
              <span className="jp-text text-2xl leading-none text-zinc-100">{entry.literal}</span>
              <div className="min-w-0 text-xs text-zinc-400">
                <div className="text-zinc-300">{entry.meanings.slice(0, 5).join(', ')}</div>
                {entry.on.length > 0 && (
                  <div className="jp-text">
                    <span className="text-zinc-600">音 </span>
                    {entry.on.join('、')}
                  </div>
                )}
                {entry.kun.length > 0 && (
                  <div className="jp-text">
                    <span className="text-zinc-600">訓 </span>
                    {entry.kun.join('、')}
                  </div>
                )}
                {(entry.strokes || entry.grade) && (
                  <div className="mt-0.5 text-zinc-600">
                    {entry.strokes && <span>{entry.strokes} strokes</span>}
                    {entry.strokes && entry.grade ? ' · ' : ''}
                    {entry.grade && <span>grade {entry.grade}</span>}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function buildSavedWord(token: Token, primary: WordEntry | undefined): SavedWord {
  return {
    lemma: token.lemma,
    surface: token.surface,
    reading: token.reading || primary?.reading || '',
    glosses: primary ? primary.senses.flatMap((s) => s.glosses).slice(0, 4) : [],
    savedAt: Date.now(),
  };
}
