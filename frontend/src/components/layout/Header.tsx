import { useHealth, type HealthStatus } from '../../hooks/useHealth';
import type { ConversationSettings } from '../../types/conversation';
import { SettingsBar } from '../settings/SettingsBar';
import { BookmarkIcon, GearIcon, SpeakerIcon, SpeakerOffIcon } from '../ui/icons';
import { Tooltip } from '../ui/Tooltip';

interface HeaderProps {
  onReset: () => void;
  scenarioTitle?: string;
  onOpenSettings: () => void;
  onOpenSaved: () => void;
  savedCount?: number;
  ttsAutoPlay?: boolean;
  onToggleAutoPlay?: () => void;
  settings: ConversationSettings;
  onSettingsChange: (s: ConversationSettings) => void;
  conversationActive: boolean;
}

const STATUS_DOT: Record<HealthStatus, { color: string; label: string }> = {
  checking: { color: 'bg-zinc-500', label: 'Checking server…' },
  online: { color: 'bg-emerald-500', label: 'Server connected' },
  offline: { color: 'bg-red-500', label: 'Server offline — is the backend running?' },
};

function ConnectionStatus() {
  const { status, info } = useHealth();
  const { color, label } = STATUS_DOT[status];
  return (
    <span className="inline-flex items-center gap-1.5" title={label} aria-label={label}>
      <span
        className={`h-2 w-2 rounded-full ${color} ${status === 'checking' ? 'animate-pulse' : ''}`}
      />
      {info && (
        <span className="hidden text-xs text-zinc-500 sm:inline">
          {info.provider} · {info.model}
        </span>
      )}
    </span>
  );
}

export function Header({
  onReset,
  scenarioTitle,
  onOpenSettings,
  onOpenSaved,
  savedCount,
  ttsAutoPlay,
  onToggleAutoPlay,
  settings,
  onSettingsChange,
  conversationActive,
}: HeaderProps) {
  return (
    <header className="grid grid-cols-3 items-center bg-surface-1 px-4 pb-1.5 pt-3">
      {/* Left */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onReset}
          aria-label="Back to home"
          title="Back to home"
          className="flex items-baseline gap-2 rounded-md transition-opacity hover:opacity-80"
        >
          <span className="jp-text text-lg font-semibold text-zinc-100">会話</span>
          <span className="text-sm tracking-wide text-zinc-500">Kaiwa</span>
        </button>
        <ConnectionStatus />
        {scenarioTitle && (
          <span className="hidden rounded-md border border-accent-500/30 bg-accent-500/10 px-2 py-0.5 text-xs text-accent-400 sm:inline">
            {scenarioTitle}
          </span>
        )}
      </div>

      {/* Center — always rendered for consistent row height */}
      <div
        className={`flex items-center justify-center gap-2 ${!conversationActive ? 'invisible pointer-events-none' : ''}`}
        aria-hidden={!conversationActive}
      >
        <SettingsBar settings={settings} onChange={onSettingsChange} />
      </div>

      {/* Right */}
      <div className="flex items-center justify-end gap-2">
        {onToggleAutoPlay && (
          <Tooltip label={ttsAutoPlay ? 'Auto-play on' : 'Auto-play off'}>
            <button
              type="button"
              onClick={onToggleAutoPlay}
              aria-label={ttsAutoPlay ? 'Disable auto-play' : 'Enable auto-play'}
              className={`rounded-lg border p-1.5 transition-colors ${
                ttsAutoPlay
                  ? 'border-accent-500/40 text-accent-400 hover:border-accent-500/60 hover:text-accent-300'
                  : 'border-border text-zinc-500 hover:border-border-strong hover:text-zinc-100'
              }`}
            >
              {ttsAutoPlay ? (
                <SpeakerIcon className="h-4 w-4" />
              ) : (
                <SpeakerOffIcon className="h-4 w-4" />
              )}
            </button>
          </Tooltip>
        )}
        <Tooltip label="Saved words">
          <button
            type="button"
            onClick={onOpenSaved}
            aria-label="Saved words and grammar"
            className="relative rounded-lg border border-border p-1.5 text-zinc-400 transition-colors hover:border-border-strong hover:text-zinc-100"
          >
            <BookmarkIcon className="h-4 w-4" />
            {!!savedCount && savedCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent-600 text-[10px] font-medium text-white">
                {savedCount > 9 ? '9+' : savedCount}
              </span>
            )}
          </button>
        </Tooltip>
        <Tooltip label="Settings">
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Open settings"
            className="rounded-lg border border-border p-1.5 text-zinc-400 transition-colors hover:border-border-strong hover:text-zinc-100"
          >
            <GearIcon className="h-4 w-4" />
          </button>
        </Tooltip>
      </div>
    </header>
  );
}
