// Which game each History chart belongs to, and which charts fit each game's data.

export const GAME_LABELS = Object.freeze({
  all: 'All games', cash: 'Cash handling', memory: 'Number memory', task: 'Task simulation',
  'error-detection': 'Error detection', 'fraud-inspection': 'Check & ID fraud inspection',
  typing: 'Typing speed', overload: 'Multitasker', chess: 'Chess',
});

export const gameLabel = (game) => GAME_LABELS[game] ?? GAME_LABELS.all;

/**
 * The tag shown on every chart, for example "Cash handling". An All games chart mixes games, so its tag also names
 * the games it combines (`games` from `gamesInAttempts`), for example "All games: Cash handling, Number memory".
 */
export const chartGameTag = (game, games = []) => (game === 'all' && games.length
  ? `${GAME_LABELS.all}: ${games.map((entry) => entry.label).join(', ')}`
  : gameLabel(game));

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

/** The note under an All games chart, for example "Games in this chart: Cash handling 40 attempts, Typing speed 8 attempts." */
export function gamesIncludedText(games) {
  if (!games.length) return '';
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
