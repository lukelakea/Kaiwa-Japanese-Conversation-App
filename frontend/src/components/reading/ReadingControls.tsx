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
        active={showFurigana}
        onToggle={onToggleFurigana}
      />
      <ToggleButton
        label="Romaji"
        sublabel="ローマ字"
        active={showRomaji}
        onToggle={onToggleRomaji}
      />
      <ToggleButton
        label="Translate"
        sublabel="翻訳"
        active={showTranslation}
        onToggle={onToggleTranslation}
      />
    </div>
  );
}
