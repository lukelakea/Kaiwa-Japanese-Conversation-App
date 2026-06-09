import { useHealth } from '../../hooks/useHealth';
import { GearIcon, HistoryIcon } from '../ui/icons';

interface HeaderProps {
  onReset: () => void;
  canReset: boolean;
  scenarioTitle?: string;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
}

const STATUS_DOT: Record<ReturnType<typeof useHealth>, { color: string; label: string }> = {
  checking: { color: 'bg-zinc-500', label: 'Checking server…' },
  online: { color: 'bg-emerald-500', label: 'Server connected' },
  offline: { color: 'bg-red-500', label: 'Server offline — is the backend running?' },
};

function ConnectionStatus() {
  const status = useHealth();
  const { color, label } = STATUS_DOT[status];
  return (
    <span
      title={label}
      aria-label={label}
      className="inline-flex h-2.5 w-2.5 items-center justify-center"
    >
      <span
        className={`h-2 w-2 rounded-full ${color} ${status === 'checking' ? 'animate-pulse' : ''}`}
      />
    </span>
  );
}

export function Header({
  onReset,
  canReset,
  scenarioTitle,
  onOpenSettings,
  onOpenHistory,
}: HeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-border bg-surface-1 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex items-baseline gap-2">
          <span className="jp-text text-lg font-semibold text-zinc-100">会話</span>
          <span className="text-sm tracking-wide text-zinc-500">Kaiwa</span>
        </div>
        <ConnectionStatus />
        {scenarioTitle && (
          <span className="hidden rounded-md border border-accent-500/30 bg-accent-500/10 px-2 py-0.5 text-xs text-accent-400 sm:inline">
            {scenarioTitle}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenHistory}
          aria-label="Conversation history"
          title="History"
          className="rounded-lg border border-border p-1.5 text-zinc-400 transition-colors hover:border-border-strong hover:text-zinc-100"
        >
          <HistoryIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Open settings"
          title="Settings"
          className="rounded-lg border border-border p-1.5 text-zinc-400 transition-colors hover:border-border-strong hover:text-zinc-100"
        >
          <GearIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onReset}
          disabled={!canReset}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:border-border-strong hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          New conversation
        </button>
      </div>
    </header>
  );
}
