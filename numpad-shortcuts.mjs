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

// List games (Error detection, Check & ID fraud inspection): keypad 1–9 toggle the numbered choices, "+" then 1–9
// reaches choices 10–18, 0 picks the "nothing wrong" choice, and keypad Enter submits.
const DIGIT_BY_KEY = Object.freeze({ 0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9 });
export const LIST_PAGE_SIZE = 9;

function keypadName(event) {
  if (/^Numpad\d$/.test(event.code ?? '')) return event.code;
  if (['NumpadAdd', 'NumpadEnter'].includes(event.code)) return event.code;
  if (event.location !== 3) return null;
  if (event.key in DIGIT_BY_KEY) return `Numpad${event.key}`;
  return event.key === '+' ? 'NumpadAdd' : event.key === 'Enter' ? 'NumpadEnter' : null;
}

/**
 * What a key does in a list game: { type: 'prefix' } for "+", { type: 'pick', number } for a numbered choice
 * (1-based), { type: 'none' } for 0, { type: 'submit' } for keypad Enter, or null. `prefix` is true when "+" was
 * the key just before this one.
 */
export function numpadListAction(event, { active = false, prefix = false } = {}) {
  if (!active || !event || event.defaultPrevented || event.repeat || event.isComposing) return null;
  if (event.ctrlKey || event.altKey || event.metaKey) return null;
  if (isTextEntry(event.target)) return null;
  const name = keypadName(event);
  if (!name) return null;
  if (name === 'NumpadAdd') return { type: 'prefix' };
  if (name === 'NumpadEnter') return { type: 'submit' };
  const digit = Number(name.slice(-1));
  if (digit === 0) return prefix ? null : { type: 'none' };
  return { type: 'pick', number: prefix ? LIST_PAGE_SIZE + digit : digit };
}

/** The key hint for numbered choice `number` (1-based): "Num 3", "Num + 2", or '' past the keypad's reach. */
export function listKeyHint(number) {
  if (number >= 1 && number <= LIST_PAGE_SIZE) return `Num ${number}`;
  if (number > LIST_PAGE_SIZE && number <= LIST_PAGE_SIZE * 2) return `Num + ${number - LIST_PAGE_SIZE}`;
  return '';
}
