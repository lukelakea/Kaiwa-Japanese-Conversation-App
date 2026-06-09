interface HeaderProps {
  onReset: () => void;
  canReset: boolean;
  scenarioTitle?: string;
}

export function Header({ onReset, canReset, scenarioTitle }: HeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-white/10 bg-surface-1 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex items-baseline gap-2">
          <span className="jp-text text-lg font-semibold text-zinc-100">会話</span>
          <span className="text-sm tracking-wide text-zinc-500">Kaiwa</span>
        </div>
        {scenarioTitle && (
          <span className="hidden rounded-md border border-accent-500/30 bg-accent-500/10 px-2 py-0.5 text-xs text-accent-400 sm:inline">
            {scenarioTitle}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={onReset}
        disabled={!canReset}
        className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:border-white/20 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
      >
        New conversation
      </button>
    </header>
  );
}
