import { motion } from 'motion/react';

import { transitions } from '../../config/motion';
import { Tooltip } from './Tooltip';

interface ToggleButtonProps {
  label: string;
  /** Smaller secondary label (e.g. a Japanese gloss). */
  sublabel?: string;
  /** Short phrase shown in a tooltip on hover. */
  tooltip?: string;
  active: boolean;
  onToggle: () => void;
}

/** A small pill toggle used for the reading-aid switches (furigana, translation). */
export function ToggleButton({ label, sublabel, tooltip, active, onToggle }: ToggleButtonProps) {
  const button = (
    <motion.button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      whileTap={{ scale: 0.95 }}
      transition={transitions.spring}
      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
        active
          ? 'border-accent-500/40 bg-accent-600/20 text-accent-400 shadow-accent-glow'
          : 'border-border text-zinc-400 hover:border-border-strong hover:text-zinc-200'
      }`}
    >
      <span>{label}</span>
      {sublabel && <span className="jp-text text-xs text-zinc-500">{sublabel}</span>}
    </motion.button>
  );

  return tooltip ? <Tooltip label={tooltip}>{button}</Tooltip> : button;
}
