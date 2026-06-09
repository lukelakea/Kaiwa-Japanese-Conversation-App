import { useSavedGrammarContext } from '../../context/SavedGrammarContext';
import { useSavedVocabContext } from '../../context/SavedVocabContext';
import { BookmarkIcon } from '../ui/icons';
import { ToggleButton } from '../ui/ToggleButton';

interface ReadingControlsProps {
  showFurigana: boolean;
  onToggleFurigana: () => void;
  showTranslation: boolean;
  onToggleTranslation: () => void;
  onOpenSaved: () => void;
}

/**
 * Reading-aid switches (brief §6–7): furigana and translation are opt-in and
 * off by default, so the default experience is clean Japanese. Also surfaces
 * the saved-words count.
 */
export function ReadingControls({
  showFurigana,
  onToggleFurigana,
  showTranslation,
  onToggleTranslation,
  onOpenSaved,
}: ReadingControlsProps) {
  const { words } = useSavedVocabContext();
  const { items: grammar } = useSavedGrammarContext();
  const savedCount = words.length + grammar.length;

  return (
    <div className="flex items-center gap-2">
      <ToggleButton
        label="Furigana"
        sublabel="ふりがな"
        active={showFurigana}
        onToggle={onToggleFurigana}
      />
      <ToggleButton
        label="Translate"
        sublabel="翻訳"
        active={showTranslation}
        onToggle={onToggleTranslation}
      />
      <button
        type="button"
        onClick={onOpenSaved}
        className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:border-white/20 hover:text-zinc-200"
      >
        <BookmarkIcon className="h-3.5 w-3.5" />
        <span>Saved</span>
        {savedCount > 0 && (
          <span className="rounded-full bg-white/10 px-1.5 text-xs text-zinc-300">
            {savedCount}
          </span>
        )}
      </button>
    </div>
  );
}
