import { useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  label: string;
  children: ReactNode;
}

/**
 * Wraps any element and shows a styled floating label on hover after a short delay.
 * Rendered in a portal so it's never clipped by overflow:hidden ancestors.
 * Intentionally z-40 — below the word-lookup WordPopover (z-50).
 */
export function Tooltip({ label, children }: TooltipProps) {
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = () => {
    timerRef.current = setTimeout(() => {
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (rect) setPos({ x: rect.left + rect.width / 2, y: rect.bottom + 6 });
    }, 400);
  };

  const hide = () => {
    clearTimeout(timerRef.current);
    setPos(null);
  };

  return (
    <span ref={wrapperRef} onMouseEnter={show} onMouseLeave={hide} className="inline-flex">
      {children}
      {pos &&
        createPortal(
          <div
            className="pointer-events-none fixed z-40 -translate-x-1/2 whitespace-nowrap rounded border border-border bg-surface-3 px-2 py-1 text-xs text-zinc-300 shadow-md"
            style={{ left: pos.x, top: pos.y }}
          >
            {label}
          </div>,
          document.body,
        )}
    </span>
  );
}
