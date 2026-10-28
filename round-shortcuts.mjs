// End-of-round keyboard shortcuts shared by every game: replay with the same settings, or go back to the main menu.
// Enter (or keypad Enter) and R replay; Escape and M return to the main menu.

import { isTextEntry } from './numpad-shortcuts.mjs?v=20261025-keypad';

export const REPLAY_KEYS = Object.freeze(['Enter', 'r', 'R']);
export const MENU_KEYS = Object.freeze(['Escape', 'm', 'M']);
export const REPLAY_HINT = 'Enter or R';
export const MENU_HINT = 'Esc or M';
// The key that ended the round (for example Enter on the last answer) must not also start the next one.
export const ROUND_END_GUARD_MS = 400;

/**
 * Which end-of-round action a key press asks for: 'replay', 'menu', or null.
 * `shownAt` and `now` are milliseconds; presses within ROUND_END_GUARD_MS of the results appearing are ignored.
 */
export function roundEndAction(event, { shownAt = 0, now = Date.now() } = {}) {
  if (!event || event.defaultPrevented || event.repeat || event.isComposing) return null;
  if (event.ctrlKey || event.altKey || event.metaKey) return null;
  if (isTextEntry(event.target)) return null;
  if (now - shownAt < ROUND_END_GUARD_MS) return null;
  const key = event.code === 'NumpadEnter' ? 'Enter' : event.key;
  // Enter on a focused button or link presses that control, as usual.
  if (key === 'Enter' && ['button', 'a', 'summary'].includes(String(event.target?.tagName ?? '').toLowerCase())) return null;
  if (REPLAY_KEYS.includes(key)) return 'replay';
  if (MENU_KEYS.includes(key)) return 'menu';
  return null;
}
