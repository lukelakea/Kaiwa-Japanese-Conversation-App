interface ToggleButtonProps {
  label: string;
  /** Smaller secondary label (e.g. a Japanese gloss). */
  sublabel?: string;
  active: boolean;
  onToggle: () => void;
}

/** A small pill toggle used for the reading-aid switches (furigana, translation). */
export function ToggleButton({ label, sublabel, active, onToggle }: ToggleButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
        active
          ? 'border-accent-500/40 bg-accent-600/20 text-accent-400'
          : 'border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-200'
      }`}
    >
      <span>{label}</span>
      {sublabel && <span className="jp-text text-xs text-zinc-500">{sublabel}</span>}
    </button>
  );
}
