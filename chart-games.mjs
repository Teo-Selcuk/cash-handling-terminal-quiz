// Which game each History chart belongs to, and which charts fit each game's data.

export const GAME_LABELS = Object.freeze({
  all: 'All games', cash: 'Cash handling', memory: 'Number memory', task: 'Task simulation',
  'error-detection': 'Error detection', 'fraud-inspection': 'Check & ID fraud inspection',
  typing: 'Typing speed', overload: 'Multitasker', chess: 'Chess',
});

export const gameLabel = (game) => GAME_LABELS[game] ?? GAME_LABELS.all;

/**
 * The tag shown on every chart, for example "Cash handling". On All games (`games` from `gamesInAttempts`), a chart
 * that uses one game says so ("Number memory only"); a chart that mixes games names them all
 * ("All games: Cash handling, Number memory").
 */
export function chartGameTag(game, games = []) {
  if (game !== 'all' || !games.length) return gameLabel(game);
  return games.length === 1 ? `${games[0].label} only` : `${GAME_LABELS.all}: ${games.map((entry) => entry.label).join(', ')}`;
}

/**
 * Puts a game's name in front of a title or label shown on All games, for example "Number memory: Digit position
 * accuracy". Text that already starts with the game's name, and unknown games, are left as they are.
 */
export function withGameName(text, game, separator = ': ') {
  const label = GAME_LABELS[game];
  if (!label || game === 'all' || String(text).toLowerCase().startsWith(label.toLowerCase())) return text;
  return `${label}${separator}${text}`;
}

/**
 * The games behind a set of attempts, most attempts first: [{ game, label, count }].
 * `gameOf(attemptId)` returns an attempt's game key; attempts it cannot place are left out.
 */
export function gamesInAttempts(attemptIds, gameOf) {
  const counts = new Map();
  for (const id of new Set(attemptIds ?? [])) {
    const game = gameOf(id);
    if (game && game !== 'all' && GAME_LABELS[game]) counts.set(game, (counts.get(game) ?? 0) + 1);
  }
  return [...counts].map(([game, count]) => ({ game, label: GAME_LABELS[game], count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

/** Plain words for the games behind a chart mark, for example "Cash handling 8, Number memory 4". */
export const gameBreakdownText = (games) => games.map((entry) => `${entry.label} ${entry.count}`).join(', ');

/**
 * The note under an All games chart, for example "Games in this chart: Cash handling 40 attempts, Typing speed 8 attempts."
 * or, for a chart from one game, "Only Number memory attempts are in this chart (232)."
 */
export function gamesIncludedText(games) {
  if (!games.length) return '';
  if (games.length === 1) return `Only ${games[0].label} attempts are in this chart (${games[0].count}).`;
  return `Games in this chart: ${games.map((entry) => `${entry.label} ${entry.count} attempt${entry.count === 1 ? '' : 's'}`).join(', ')}.`;
}

// Charts that do not fit a game's data are left off that game's page instead of being drawn empty or twice.
const DROP = Object.freeze({
  // With one game picked, "Strongest documented variables" groups by difficulty: the same numbers as
  // "Accuracy by difficulty" at the top of the page.
  single: Object.freeze(['strongest-variables']),
  // Typing tests run against a fixed timer and measure speed in words per minute. Its own WPM and character
  // accuracy charts cover speed; answer-second bands and response-time charts do not fit.
  typing: Object.freeze(['response-time-over-time', 'speed-vs-accuracy', 'accuracy-by-response-band', 'performance-distribution']),
});

export function chartFitsGame(chartId, game) {
  if (game !== 'all' && DROP.single.includes(chartId)) return false;
  return !(DROP[game] ?? []).includes(chartId);
}
