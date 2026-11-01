// Numeric-only answer entry: digits and one decimal point, at most two decimal places for money. Every game that
// asks for a typed number (Cash handling, Number memory, Task simulation, Multitasker math) uses these rules.
// The rules are pure so they can be tested without a browser; `attachAmountFilter` wires them to an input box.

export const AMOUNT_MAX_DECIMALS = 2;
export const AMOUNT_MAX_LENGTH = 10;

/**
 * Keeps only the characters a money amount may hold. `caret` (optional) is a position in `value`; the result maps it
 * to the same place in the cleaned text. Rules: digits always; the first "." only (when `decimal` is true); at most
 * `maxDecimals` digits after it; a "-" only as the first character (when `negative` is true); at most `maxLength`
 * characters. `removed` is true when anything was dropped.
 */
export function sanitizeAmount(value, { caret = null, decimal = true, negative = false, maxDecimals = AMOUNT_MAX_DECIMALS, maxLength = AMOUNT_MAX_LENGTH } = {}) {
  const text = String(value ?? '');
  let kept = '';
  let mappedCaret = 0;
  let hasPoint = false;
  let decimals = 0;
  let removed = false;
  let tooLong = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    let keep = false;
    if (/[0-9]/.test(char)) keep = !hasPoint || decimals < maxDecimals;
    else if (char === '.' && decimal) keep = !hasPoint;
    else if (char === '-' && negative) keep = kept === '';
    if (keep && kept.length >= maxLength) { keep = false; tooLong = true; }
    if (!keep) { removed = true; continue; }
    if (char === '.') hasPoint = true;
    else if (hasPoint) decimals += 1;
    kept += char;
    if (caret !== null && index < caret) mappedCaret += 1;
  }
  return { value: kept, caret: caret === null ? null : mappedCaret, removed, tooLong };
}

/** What typing `data` over the selection [start, end) would leave in the box. */
export function proposedValue(value, start, end, data) {
  return `${value.slice(0, start)}${data}${value.slice(end)}`;
}

/**
 * Reads a typed amount once it is valid. Returns { status: 'empty' } for a blank box or a lone ".",
 * { status: 'invalid' } for anything the filter would not allow, otherwise { status: 'ok', cents }.
 * A trailing "." (for example "12.") counts as whole dollars.
 */
export function readAmountCents(value) {
  const text = String(value ?? '').trim();
  if (text === '' || text === '.') return { status: 'empty' };
  if (!/^(?:\d+\.?\d{0,2}|\.\d{1,2})$/.test(text)) return { status: 'invalid' };
  const [whole, fraction = ''] = text.split('.');
  const cents = Number(whole || '0') * 100 + Number(`${fraction}00`.slice(0, 2));
  return Number.isSafeInteger(cents) ? { status: 'ok', cents } : { status: 'invalid' };
}

/** The message shown when characters were removed; `label` names what the box holds ("Amounts", "Values", ...). */
export function removedMessage({ label, decimal = true, negative = false, maxDecimals = AMOUNT_MAX_DECIMALS } = {}) {
  const name = label ?? (decimal ? 'Amounts' : 'Counts');
  const places = Number.isFinite(maxDecimals) ? `, with up to ${maxDecimals === 2 ? 'two' : maxDecimals} decimal places` : '';
  const rule = decimal ? `digits and one decimal point${places}` : 'digits only';
  return `Some characters were removed. ${name} use ${rule}.${negative ? ' A minus sign may come first.' : ''}`;
}

/**
 * Filters an input box as the user types, pastes, drops or autofills. Invalid typed characters are blocked before
 * they appear; pasted or inserted text keeps only its valid characters. A typed "," becomes the decimal point when
 * the box has none yet (mobile keyboards that use a comma); pasted commas are dropped as thousands separators.
 * Options: `decimal` (allow one "."), `maxDecimals`, `negative` (allow a leading "-"), `maxLength`, and `label` for
 * the message. `onRemoved(message)` reports what was removed so the page can announce it.
 */
export function attachAmountFilter(input, { decimal = true, negative = false, maxDecimals = AMOUNT_MAX_DECIMALS, maxLength = AMOUNT_MAX_LENGTH, label, onRemoved = () => {} } = {}) {
  const options = { decimal, negative, maxDecimals, maxLength };
  const limitMessage = `${label ?? 'Amounts'} can be at most ${maxLength} characters.`;
  const message = removedMessage({ label, decimal, negative, maxDecimals });
  input.addEventListener('beforeinput', (event) => {
    if (event.inputType !== 'insertText' || event.data === null) return;
    let data = event.data;
    if (decimal && data === ',' && !input.value.includes('.')) data = '.';
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    const next = proposedValue(input.value, start, end, data);
    const clean = sanitizeAmount(next, options);
    if (clean.value === next && data === event.data) return;
    event.preventDefault();
    if (clean.value === next) {
      input.setRangeText(data, start, end, 'end');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (clean.tooLong) {
      onRemoved(limitMessage);
    }
  });
  input.addEventListener('input', () => {
    const caret = input.selectionStart ?? input.value.length;
    const clean = sanitizeAmount(input.value, { ...options, caret });
    if (!clean.removed) return;
    input.value = clean.value;
    input.setSelectionRange?.(clean.caret, clean.caret);
    onRemoved(clean.tooLong ? limitMessage : message);
  });
}
