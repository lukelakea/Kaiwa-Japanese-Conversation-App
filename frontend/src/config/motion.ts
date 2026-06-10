/**
 * Central motion vocabulary for the app, mirroring how config/settings.ts
 * centralizes UI metadata. Variants and transitions are defined once here so
 * every animated surface (messages, drawers, popovers, cards) feels related.
 *
 * Durations/easing match the CSS tokens in index.css (--duration-*,
 * --ease-out-soft). `motion` automatically honours prefers-reduced-motion, so
 * these need no manual guards.
 */
import type { Transition, Variants } from 'motion/react';

/** Signature easing curve — matches --ease-out-soft in index.css. */
const EASE_OUT_SOFT: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const transitions = {
  /** Soft tween for entrances/exits. */
  soft: { duration: 0.22, ease: EASE_OUT_SOFT } satisfies Transition,
  /** Gentle spring for interactive surfaces (drawers, taps). */
  spring: { type: 'spring', stiffness: 380, damping: 32 } satisfies Transition,
} as const;

/** Message bubble: fade + small rise + subtle scale. */
export const bubbleVariants: Variants = {
  hidden: { opacity: 0, y: 8, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: transitions.soft },
};

/** Container that staggers its children (message list, card grids). */
export const listStagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};

/** Popover / dropdown menu: quick scale-in from the anchor. */
export const popVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: -4 },
  visible: { opacity: 1, scale: 1, y: 0, transition: transitions.soft },
  exit: { opacity: 0, scale: 0.96, y: -4, transition: { duration: 0.12 } },
};

/** Slide-over drawer (Saved panel) — enters from the right edge. */
export const drawerVariants: Variants = {
  hidden: { x: '100%' },
  visible: { x: 0, transition: transitions.spring },
  exit: { x: '100%', transition: { duration: 0.2, ease: EASE_OUT_SOFT } },
};

/** Backdrop behind a drawer / modal. */
export const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transitions.soft },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

/** Quiet fade + rise for first-paint heroes (empty state, mode picker). */
export const fadeRise: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: transitions.soft },
};

/** Light fade/slide for swapping steps in place (mode-picker flow, banner). */
export const fadeSlide: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: transitions.soft },
  exit: { opacity: 0, y: -6, transition: { duration: 0.15 } },
};
