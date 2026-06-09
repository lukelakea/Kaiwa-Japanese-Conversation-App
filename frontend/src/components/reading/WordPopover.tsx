import { motion } from 'motion/react';
import { createPortal } from 'react-dom';

import { popVariants } from '../../config/motion';
import { useSavedVocabContext } from '../../context/SavedVocabContext';
import { useTokenLookup } from '../../hooks/useTokenLookup';
import type { KanjiEntry, SavedWord, Token, WordEntry } from '../../types/reading';
import { BookmarkIcon } from '../ui/icons';

const POPOVER_WIDTH = 320;
// Approximate height used to decide whether to flip above the token.
const FLIP_THRESHOLD = 260;

interface WordPopoverProps {
  token: Token;
  /** Viewport rect of the hovered token, used to position the popover. */
  anchor: DOMRect;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}

/**
 * Floating dictionary card for a hovered token (brief §7): JMdict word senses,
 * per-kanji detail, and a one-click save. Rendered in a portal so it is never
 * clipped by the scrolling message list.
 */
export function WordPopover({ token, anchor, onPointerEnter, onPointerLeave }: WordPopoverProps) {
  const { result, loading, error } = useTokenLookup(token, true);
  const { has, save, remove } = useSavedVocabContext();
  const saved = has(token.lemma);

  const flipUp = anchor.bottom > window.innerHeight - FLIP_THRESHOLD;
  const left = Math.max(8, Math.min(anchor.left, window.innerWidth - POPOVER_WIDTH - 8));
  const style: React.CSSProperties = {
    width: POPOVER_WIDTH,
    left,
    ...(flipUp ? { bottom: window.innerHeight - anchor.top + 6 } : { top: anchor.bottom + 6 }),
  };

  const toggleSave = () =>
    saved ? remove(token.lemma) : save(buildSavedWord(token, result?.words[0]));

  return createPortal(
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
          <span className="jp-text text-lg text-accent-400">{token.surface}</span>
          {token.reading && token.reading !== token.surface && (
            <span className="jp-text ml-2 text-zinc-400">{token.reading}</span>
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

      {loading && <p className="text-zinc-500">Looking up…</p>}
      {error && <p className="text-zinc-500">Couldn’t load the dictionary.</p>}
      {result && !loading && <DictionaryBody words={result.words} kanji={result.kanji} />}
    </motion.div>,
    document.body,
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
                    {sense.partOfSpeech.length > 0 && (
                      <span className="mr-1 text-xs italic text-zinc-500">
                        {sense.partOfSpeech[0]}
                      </span>
                    )}
                    {sense.glosses.slice(0, 4).join('; ')}
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
