// Which game each History chart belongs to, and which charts fit each game's data.

export const GAME_LABELS = Object.freeze({
  all: 'All games', cash: 'Cash handling', memory: 'Number memory', task: 'Task simulation',
  'error-detection': 'Error detection', 'fraud-inspection': 'Check & ID fraud inspection',
  typing: 'Typing speed', overload: 'Multitasker', chess: 'Chess',
});

export const gameLabel = (game) => GAME_LABELS[game] ?? GAME_LABELS.all;

/** The tag shown on every chart, for example "Cash handling". */
export const chartGameTag = (game) => gameLabel(game);

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
