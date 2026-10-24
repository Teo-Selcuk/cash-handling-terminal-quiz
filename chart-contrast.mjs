// Chart label colors that stay readable. Every Appearance choice is turned into a real color for the current
// theme, then nudged lighter (dark theme) or darker (light theme) until it reaches a readable contrast against
// every background the label can sit on.

export const MIN_LABEL_CONTRAST = 4.5; // WCAG AA for normal text.

// Theme colors from style.css. Labels can sit on a card (surface-quiet) or on the plain surface.
export const THEME_COLORS = Object.freeze({
  light: Object.freeze({ ink: '#17272a', backgrounds: Object.freeze(['#ffffff', '#eaf0ed']), blue: '#0754a8', purple: '#7036a5', red: '#a73131' }),
  dark: Object.freeze({ ink: '#edf5f2', backgrounds: Object.freeze(['#142326', '#1c3032']), blue: '#91c3ff', purple: '#d0a7f2', red: '#ffaaa3' }),
});

const HEX = /^#[0-9a-f]{6}$/i;

export function hexToRgb(hex) {
  if (!HEX.test(hex)) return null;
  return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
}

const toHex = (rgb) => `#${rgb.map((part) => Math.round(Math.min(255, Math.max(0, part))).toString(16).padStart(2, '0')).join('')}`;

export function relativeLuminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((part) => {
    const channel = part / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(first, second) {
  const a = relativeLuminance(first);
  const b = relativeLuminance(second);
  if (a === null || b === null) return null;
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Mix the color toward white or black, a little at a time, until it is readable on every background. */
export function readableColor(hex, backgrounds, minimum = MIN_LABEL_CONTRAST) {
  const rgb = hexToRgb(hex);
  if (!rgb || !backgrounds.length) return hex;
  const worst = (color) => Math.min(...backgrounds.map((background) => contrastRatio(color, background)));
  if (worst(hex) >= minimum) return hex.toLowerCase();
  const backgroundLight = backgrounds.reduce((sum, background) => sum + relativeLuminance(background), 0) / backgrounds.length > 0.4;
  const target = backgroundLight ? [0, 0, 0] : [255, 255, 255];
  for (let step = 1; step <= 20; step += 1) {
    const mixed = toHex(rgb.map((part, index) => part + (target[index] - part) * (step / 20)));
    if (worst(mixed) >= minimum) return mixed;
  }
  return toHex(target);
}

/**
 * The label color to draw for one chart's Appearance settings in one theme.
 * `auto` and `ink` are the theme's text color: white in the dark theme and dark ink in the light theme.
 * With a label background on, the label must read on that background instead of the card.
 */
export function resolveLabelColor(settings = {}, theme = 'light') {
  const colors = THEME_COLORS[theme === 'dark' ? 'dark' : 'light'];
  const choice = settings.labelColor ?? 'auto';
  const chosen = choice === 'custom' && HEX.test(settings.customColor ?? '') ? settings.customColor
    : colors[choice] ?? colors.ink;
  const backgrounds = settings.labelBackground && HEX.test(settings.backgroundColor ?? '') ? [settings.backgroundColor] : colors.backgrounds;
  return readableColor(chosen, backgrounds);
}
