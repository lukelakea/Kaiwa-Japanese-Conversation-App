import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';

import { fetchSpeakers } from '../../api/client';
import type { SpeakerOption } from '../../api/client';
import { backdropVariants, drawerVariants } from '../../config/motion';
import type { AppSettings, TextSize } from '../../types/settings';
import { TEXT_SIZE_CLASS } from '../../types/settings';
import { CloseIcon } from '../ui/icons';

interface AppSettingsPanelProps {
  open: boolean;
  settings: AppSettings;
  onChange: (patch: Partial<AppSettings>) => void;
  onClose: () => void;
}

const TEXT_SIZE_OPTIONS: { value: TextSize; label: string }[] = [
  { value: 'sm', label: 'S' },
  { value: 'md', label: 'M' },
  { value: 'lg', label: 'L' },
  { value: 'xl', label: 'XL' },
];

export function AppSettingsPanel({ open, settings, onChange, onClose }: AppSettingsPanelProps) {
  const [speakers, setSpeakers] = useState<SpeakerOption[]>([]);
  const [speakersStatus, setSpeakersStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  // Fetch speakers once when the panel opens.
  useEffect(() => {
    if (!open) return;
    setSpeakersStatus('loading');
    const controller = new AbortController();
    fetchSpeakers(controller.signal).then((list) => {
      setSpeakers(list);
      setSpeakersStatus(list.length === 0 ? 'error' : 'idle');
    });
    return () => controller.abort();
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-40">
          {/* Backdrop */}
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="absolute inset-0 bg-black/50"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.aside
            variants={drawerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute inset-y-0 right-0 flex w-80 flex-col bg-surface-1 shadow-2xl"
            aria-label="App settings"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold text-zinc-100">Settings</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close settings"
                className="rounded p-1 text-zinc-500 transition-colors hover:text-zinc-200"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-7">
              {/* Display section */}
              <section>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Display
                </p>
                <div className="space-y-3">
                  <label className="block text-sm text-zinc-300">Text size</label>
                  <div className="flex gap-1.5">
                    {TEXT_SIZE_OPTIONS.map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => onChange({ textSize: value })}
                        aria-pressed={settings.textSize === value}
                        className={`flex-1 rounded-lg border py-1.5 text-sm font-medium transition-colors ${
                          settings.textSize === value
                            ? 'border-accent-500/40 bg-accent-600/20 text-accent-400'
                            : 'border-border text-zinc-400 hover:border-border-strong hover:text-zinc-200'
                        }`}
                      >
                        <span className={TEXT_SIZE_CLASS[value]}>{label}</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-zinc-600">
                    Affects conversation text and furigana size.
                  </p>
                </div>
              </section>

              {/* Voice section */}
              <section>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Voice
                </p>
                <label className="mb-3 block text-sm text-zinc-300">VOICEVOX speaker</label>

                {speakersStatus === 'loading' && (
                  <p className="text-sm text-zinc-500">Loading speakers…</p>
                )}

                {speakersStatus === 'error' && (
                  <p className="text-sm text-zinc-600">
                    VOICEVOX is not running — start it to choose a voice.
                  </p>
                )}

                {speakersStatus === 'idle' && speakers.length > 0 && (
                  <div className="space-y-1">
                    {/* "Server default" option */}
                    <VoiceOption
                      id={null}
                      name="Server default"
                      selected={settings.ttsVoice === null}
                      onSelect={() => onChange({ ttsVoice: null })}
                    />
                    {speakers.map((s) => (
                      <VoiceOption
                        key={s.id}
                        id={s.id}
                        name={s.name}
                        selected={settings.ttsVoice === s.id}
                        onSelect={() => onChange({ ttsVoice: s.id })}
                      />
                    ))}
                  </div>
                )}
              </section>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

interface VoiceOptionProps {
  id: number | null;
  name: string;
  selected: boolean;
  onSelect: () => void;
}

function VoiceOption({ name, selected, onSelect }: VoiceOptionProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
        selected
          ? 'bg-accent-600/15 text-accent-400'
          : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
      }`}
    >
      <span
        className={`h-3.5 w-3.5 shrink-0 rounded-full border transition-colors ${
          selected ? 'border-accent-500 bg-accent-500' : 'border-zinc-600'
        }`}
      />
      <span className="jp-text">{name}</span>
    </button>
  );
}
