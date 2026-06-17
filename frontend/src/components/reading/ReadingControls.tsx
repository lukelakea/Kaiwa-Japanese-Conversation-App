import { ToggleButton } from '../ui/ToggleButton';

interface ReadingControlsProps {
  showFurigana: boolean;
  onToggleFurigana: () => void;
  showRomaji: boolean;
  onToggleRomaji: () => void;
  showTranslation: boolean;
  onToggleTranslation: () => void;
}

/** Reading-aid switches: furigana and translation are opt-in and off by default. */
export function ReadingControls({
  showFurigana,
  onToggleFurigana,
  showRomaji,
  onToggleRomaji,
  showTranslation,
  onToggleTranslation,
}: ReadingControlsProps) {
  return (
    <div className="flex items-center gap-2">
      <ToggleButton
        label="Furigana"
        sublabel="ふりがな"
        tooltip="Show reading aids above kanji"
        active={showFurigana}
        onToggle={onToggleFurigana}
      />
      <ToggleButton
        label="Romaji"
        sublabel="ローマ字"
        tooltip="Show Latin-script pronunciation"
        active={showRomaji}
        onToggle={onToggleRomaji}
      />
      <ToggleButton
        label="Translate"
        sublabel="翻訳"
        tooltip="Show English translations"
        active={showTranslation}
        onToggle={onToggleTranslation}
      />
    </div>
  );
}
