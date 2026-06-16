import type { TranslationStatus } from '../../types/conversation';

interface TranslationTextProps {
  text?: string;
  status?: TranslationStatus;
  onRetry: () => void;
  className?: string;
}

/** Renders an on-demand English translation, its loading state, or a retry affordance. */
export function TranslationText({ text, status, onRetry, className = '' }: TranslationTextProps) {
  if (status === 'loading') {
    return (
      <span className={`inline-flex items-center gap-1 ${className}`}>
        <span className="text-sm text-zinc-500">Translating</span>
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="h-1 w-1 animate-bounce rounded-full bg-zinc-500"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </span>
    );
  }
  if (status === 'error') {
    return (
      <button
        type="button"
        onClick={onRetry}
        className={`text-sm text-zinc-500 underline decoration-dotted underline-offset-2 hover:text-zinc-300 ${className}`}
      >
        Translation failed — retry
      </button>
    );
  }
  if (text) {
    return <p className={`text-sm text-zinc-400 ${className}`}>{text}</p>;
  }
  return null;
}
