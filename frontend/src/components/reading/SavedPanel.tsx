import { useEffect, useState } from 'react';

import { useSavedGrammarContext } from '../../context/SavedGrammarContext';
import { useSavedVocabContext } from '../../context/SavedVocabContext';
import type { SavedGrammar } from '../../types/feedback';
import type { SavedWord } from '../../types/reading';
import { CloseIcon } from '../ui/icons';

interface SavedPanelProps {
  open: boolean;
  onClose: () => void;
}

type Tab = 'words' | 'grammar';

/**
 * Slide-over of saved study items: vocabulary (brief §7) and grammar points
 * (brief §7–8), split across two tabs. Both read from their shared localStorage
 * stores, so items saved from a reply or a feedback annotation appear here at
 * once.
 */
export function SavedPanel({ open, onClose }: SavedPanelProps) {
  const { words, remove: removeWord } = useSavedVocabContext();
  const { items: grammar, remove: removeGrammar } = useSavedGrammarContext();
  const [tab, setTab] = useState<Tab>('words');

  // Close on Escape while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <aside
        role="dialog"
        aria-label="Saved items"
        className="absolute right-0 top-0 flex h-full w-full max-w-sm flex-col border-l border-white/10 bg-surface-1 shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 className="text-sm font-semibold text-zinc-200">Saved</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-200"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </header>

        <div className="flex gap-1 border-b border-white/10 px-2 py-2">
          <TabButton
            label="Words"
            count={words.length}
            active={tab === 'words'}
            onClick={() => setTab('words')}
          />
          <TabButton
            label="Grammar"
            count={grammar.length}
            active={tab === 'grammar'}
            onClick={() => setTab('grammar')}
          />
        </div>

        {tab === 'words' ? (
          <WordList words={words} onRemove={removeWord} />
        ) : (
          <GrammarList items={grammar} onRemove={removeGrammar} />
        )}
      </aside>
    </div>
  );
}

function TabButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
        active ? 'bg-white/10 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
      }`}
    >
      <span>{label}</span>
      {count > 0 && (
        <span className="rounded-full bg-white/10 px-1.5 text-xs text-zinc-300">{count}</span>
      )}
    </button>
  );
}

function WordList({ words, onRemove }: { words: SavedWord[]; onRemove: (lemma: string) => void }) {
  if (words.length === 0) {
    return (
      <p className="px-4 py-6 text-sm text-zinc-500">
        No saved words yet. Hover a word in a reply and press Save.
      </p>
    );
  }
  return (
    <ul className="flex-1 overflow-y-auto">
      {words.map((word) => (
        <li
          key={word.lemma}
          className="flex items-start justify-between gap-3 border-b border-white/5 px-4 py-3"
        >
          <div className="min-w-0">
            <div className="jp-text text-zinc-100">
              {word.surface}
              {word.reading && word.reading !== word.surface && (
                <span className="ml-2 text-sm text-zinc-500">{word.reading}</span>
              )}
            </div>
            {word.glosses.length > 0 && (
              <div className="mt-0.5 truncate text-sm text-zinc-400">{word.glosses.join('; ')}</div>
            )}
          </div>
          <RemoveButton label={`Remove ${word.surface}`} onClick={() => onRemove(word.lemma)} />
        </li>
      ))}
    </ul>
  );
}

function GrammarList({
  items,
  onRemove,
}: {
  items: SavedGrammar[];
  onRemove: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="px-4 py-6 text-sm text-zinc-500">
        No saved grammar yet. Expand a suggestion on one of your messages and press “Save grammar
        point”.
      </p>
    );
  }
  return (
    <ul className="flex-1 overflow-y-auto">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex items-start justify-between gap-3 border-b border-white/5 px-4 py-3"
        >
          <div className="min-w-0">
            <p className="jp-text text-sm text-zinc-500 line-through decoration-zinc-600">
              {item.original}
            </p>
            <p className="jp-text mt-0.5 text-zinc-100">{item.correction}</p>
            {item.explanation && <p className="mt-1 text-sm text-zinc-400">{item.explanation}</p>}
          </div>
          <RemoveButton label="Remove grammar point" onClick={() => onRemove(item.id)} />
        </li>
      ))}
    </ul>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="shrink-0 rounded-md p-1 text-zinc-500 transition-colors hover:bg-white/10 hover:text-zinc-300"
    >
      <CloseIcon className="h-4 w-4" />
    </button>
  );
}
