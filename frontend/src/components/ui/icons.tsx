/** Small inline icons. Inheriting `currentColor` keeps them theme-aware. */

type IconProps = { className?: string };

export function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden className={className}>
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SendIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden className={className}>
      <path
        d="M3 10l14-7-4 14-3.5-5.5L3 10z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StopIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden className={className}>
      <rect x="5" y="5" width="10" height="10" rx="2" />
    </svg>
  );
}

export function BookmarkIcon({ className, filled = false }: IconProps & { filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill={filled ? 'currentColor' : 'none'}
      aria-hidden
      className={className}
    >
      <path
        d="M4 2.5h8a.5.5 0 0 1 .5.5v10.5L8 11l-4.5 2.5V3a.5.5 0 0 1 .5-.5z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden className={className}>
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** Speech bubble — the feedback / suggestion affordance (brief §8). */
export function ChatIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden className={className}>
      <path
        d="M2.5 3.5h11a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H6l-3 2.5V11.5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden className={className}>
      <path
        d="M3.5 8.5l3 3 6-7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ChevronRightIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden className={className}>
      <path
        d="M6 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
