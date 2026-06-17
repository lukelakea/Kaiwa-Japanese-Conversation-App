import { AnimatePresence, motion } from 'motion/react';
import { useRef, useState } from 'react';

import { popVariants } from '../../config/motion';
import type { SettingOption } from '../../config/settings';
import { useClickOutside } from '../../hooks/useClickOutside';
import { ChevronDownIcon } from '../ui/icons';
import { Tooltip } from '../ui/Tooltip';

interface SettingDropdownProps<T extends string> {
  title: string;
  /** Short phrase shown in a tooltip on the trigger button. */
  description?: string;
  value: T;
  options: SettingOption<T>[];
  onChange: (value: T) => void;
}

/**
 * A compact labelled dropdown for one conversation setting. Generic over the
 * option value type so it works for every setting group without duplication.
 */
export function SettingDropdown<T extends string>({
  title,
  description,
  value,
  options,
  onChange,
}: SettingDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setOpen(false), open);

  const selected = options.find((option) => option.value === value) ?? options[0];

  const trigger = (
    <button
      type="button"
      onClick={() => setOpen((prev) => !prev)}
      aria-haspopup="listbox"
      aria-expanded={open}
      className="flex w-full items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-left transition-colors hover:border-border-strong"
    >
      <span className="flex flex-col">
        <span className="text-[0.65rem] font-medium uppercase tracking-wide text-zinc-500">
          {title}
        </span>
        <span className="text-sm text-zinc-100">{selected.label}</span>
      </span>
      <ChevronDownIcon
        className={`ml-auto h-4 w-4 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`}
      />
    </button>
  );

  return (
    <div ref={containerRef} className="relative">
      {description && !open ? (
        <Tooltip label={description}>{trigger}</Tooltip>
      ) : (
        trigger
      )}

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            variants={popVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            style={{ transformOrigin: 'top' }}
            className="absolute z-20 mt-1.5 w-60 overflow-hidden rounded-xl border border-border bg-surface-3 p-1 shadow-lg"
          >
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <li key={option.value} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${
                      isSelected ? 'bg-accent-500/15' : 'hover:bg-white/5'
                    }`}
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span
                        className={`text-sm ${isSelected ? 'text-accent-400' : 'text-zinc-100'}`}
                      >
                        {option.label}
                      </span>
                      <span className="jp-text text-xs text-zinc-500">{option.labelJa}</span>
                    </span>
                    <span className="mt-0.5 block text-xs text-zinc-500">{option.hint}</span>
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
