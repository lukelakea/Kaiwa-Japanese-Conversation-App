import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';

import { fetchHealth, fetchSpeakers } from '../../api/client';
import type { HealthInfo, SpeakerOption } from '../../api/client';
import { backdropVariants, drawerVariants } from '../../config/motion';
import type { AppSettings, TextSize, TtsSpeed } from '../../types/settings';
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

const TTS_SPEED_OPTIONS: { value: TtsSpeed; label: string }[] = [
  { value: 0.5, label: '0.5×' },
  { value: 0.75, label: '0.75×' },
  { value: 1.0, label: '1×' },
];

export function AppSettingsPanel({ open, settings, onChange, onClose }: AppSettingsPanelProps) {
  const [speakers, setSpeakers] = useState<SpeakerOption[]>([]);
  const [speakersStatus, setSpeakersStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [serverInfo, setServerInfo] = useState<HealthInfo | null>(null);

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

  // Fetch server info once when the panel opens.
  useEffect(() => {
    if (!open) return;
    fetchHealth().then(setServerInfo);
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

                {/* Input translation toggle */}
                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-zinc-300">Input translation</p>
                    <p className="text-xs text-zinc-600">
                      Show an English preview of your message as you type
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.inputTranslation}
                    onClick={() => onChange({ inputTranslation: !settings.inputTranslation })}
                    className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                      settings.inputTranslation ? 'bg-accent-600' : 'bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                        settings.inputTranslation ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </section>

              {/* Voice section */}
              <section>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Voice
                </p>

                {/* Playback speed */}
                <div className="mb-4 space-y-2">
                  <label className="block text-sm text-zinc-300">Playback speed</label>
                  <div className="flex gap-1.5">
                    {TTS_SPEED_OPTIONS.map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => onChange({ ttsSpeed: value })}
                        aria-pressed={settings.ttsSpeed === value}
                        className={`flex-1 rounded-lg border py-1.5 text-sm font-medium transition-colors ${
                          settings.ttsSpeed === value
                            ? 'border-accent-500/40 bg-accent-600/20 text-accent-400'
                            : 'border-border text-zinc-400 hover:border-border-strong hover:text-zinc-200'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {serverInfo?.ttsProvider === 'google' ? (
                  <p className="text-sm text-zinc-600">
                    Voice powered by Google Cloud TTS — speaker selection isn't available on this
                    demo.
                  </p>
                ) : (
                  <>
                    <label htmlFor="tts-voice-select" className="mb-2 block text-sm text-zinc-300">
                      VOICEVOX speaker
                    </label>

                    {speakersStatus === 'loading' && (
                      <p className="text-sm text-zinc-500">Loading speakers…</p>
                    )}

                    {speakersStatus === 'error' && (
                      <p className="text-sm text-zinc-600">
                        VOICEVOX is not running — start it to choose a voice.
                      </p>
                    )}

                    {speakersStatus === 'idle' && speakers.length > 0 && (
                      <select
                        id="tts-voice-select"
                        value={settings.ttsVoice ?? ''}
                        onChange={(e) =>
                          onChange({
                            ttsVoice: e.target.value === '' ? null : Number(e.target.value),
                          })
                        }
                        className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-accent-500/50 jp-text"
                      >
                        <option value="">Server default</option>
                        {speakers.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </>
                )}
              </section>

              {/* Server section */}
              <section>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Model
                </p>
                {serverInfo ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-500">Provider</span>
                      <span className="font-medium text-zinc-300">{serverInfo.provider}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="shrink-0 text-zinc-500">Model</span>
                      <span className="ml-4 truncate text-right font-medium text-zinc-300">
                        {serverInfo.model}
                      </span>
                    </div>
                    <p className="pt-1 text-xs text-zinc-600">
                      Set{' '}
                      <code className="rounded bg-surface-2 px-1 py-0.5 text-zinc-500">
                        KAIWA_LLM_PROVIDER
                      </code>{' '}
                      in <code className="rounded bg-surface-2 px-1 py-0.5 text-zinc-500">backend/.env</code> to change.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-600">Server offline</p>
                )}
              </section>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
