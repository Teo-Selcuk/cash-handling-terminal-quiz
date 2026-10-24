// Numeric keypad shortcuts for click-only answer choices. Keys are matched by `event.code`, so only the
// keypad keys count: the "-" on the main keyboard and "/" or "*" typed elsewhere are left alone.

export const CASH_NUMPAD_KEYS = Object.freeze({ NumpadDivide: 'Exact', NumpadMultiply: 'Change', NumpadSubtract: 'Short' });
const KEYPAD_CODE_BY_KEY = Object.freeze({ '/': 'NumpadDivide', '*': 'NumpadMultiply', '-': 'NumpadSubtract' });
export const CASH_KEY_HINTS = Object.freeze({ Exact: 'Num /', Change: 'Num *', Short: 'Num -' });

const TEXT_INPUT_TYPES = new Set(['text', 'search', 'email', 'number', 'password', 'tel', 'url', 'date', 'time', 'datetime-local', 'month', 'week']);

/** True when the element takes typed text, so keys must reach it instead of picking an answer. */
export function isTextEntry(element) {
  if (!element || typeof element !== 'object') return false;
  if (element.isContentEditable) return true;
  const tag = String(element.tagName ?? '').toLowerCase();
  if (tag === 'textarea' || tag === 'select') return true;
  return tag === 'input' && TEXT_INPUT_TYPES.has(String(element.type ?? 'text').toLowerCase());
}

/** The answer a key press picks, or null. `active` is whether a cash question is waiting for an answer. */
export function numpadChoice(event, { active = false, keys = CASH_NUMPAD_KEYS } = {}) {
  if (!active || !event || event.defaultPrevented || event.repeat || event.isComposing) return null;
  if (event.ctrlKey || event.altKey || event.metaKey) return null;
  if (isTextEntry(event.target)) return null;
  if (keys[event.code]) return keys[event.code];
  // Some keyboards and remote sessions leave `code` blank; the keypad still reports location 3.
  if (event.location === 3) return keys[KEYPAD_CODE_BY_KEY[event.key]] ?? null;
  return null;
}
