import { useEffect } from 'react';

import { useSavedVocabContext } from '../../context/SavedVocabContext';
import { CloseIcon } from '../ui/icons';

interface SavedVocabPanelProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Slide-over list of saved vocabulary (brief §7). Read from localStorage via
 * the shared store, so words saved from a hover popover appear here immediately.
 */
export function SavedVocabPanel({ open, onClose }: SavedVocabPanelProps) {
  const { words, remove } = useSavedVocabContext();

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
        aria-label="Saved words"
        className="absolute right-0 top-0 flex h-full w-full max-w-sm flex-col border-l border-white/10 bg-surface-1 shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 className="text-sm font-semibold text-zinc-200">
            Saved words
            {words.length > 0 && <span className="ml-2 text-zinc-500">{words.length}</span>}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-200"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </header>

        {words.length === 0 ? (
          <p className="px-4 py-6 text-sm text-zinc-500">
            No saved words yet. Hover a word in a reply and press Save.
          </p>
        ) : (
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
                    <div className="mt-0.5 truncate text-sm text-zinc-400">
                      {word.glosses.join('; ')}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => remove(word.lemma)}
                  aria-label={`Remove ${word.surface}`}
                  className="shrink-0 rounded-md p-1 text-zinc-500 transition-colors hover:bg-white/10 hover:text-zinc-300"
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
