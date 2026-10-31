// Answer result pop-up for Auto-continue. The next question opens at once, so a small note in the top-right corner
// says whether the last answer was right or wrong and, when it was wrong, what the right answer was.
// The content rules are pure so they can be tested without a browser; app.js shows and hides the note.

export const ANSWER_TOAST_CORRECT_MS = 3000;
// Wrong answers and timeouts show the right answer too, so they stay a little longer to read.
export const ANSWER_TOAST_WRONG_MS = 4000;
// Long answers (typing passages, task steps) are shortened so the note stays small.
export const ANSWER_TOAST_MAX_TEXT = 160;

const GAME_NAMES = Object.freeze({
  cash: 'Cash handling', memory: 'Number memory', task: 'Task simulation', 'error-detection': 'Error detection',
  'fraud-inspection': 'Check & ID fraud inspection', typing: 'Typing speed',
});

export function shortenToastText(value, max = ANSWER_TOAST_MAX_TEXT) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function cashAnswerText(type, amount) {
  if (!type) return 'No answer';
  return type === 'Exact' ? 'Exact amount' : `${type} ${amount ?? ''}`.trim();
}

/**
 * What the note says for one saved answer. `record` is the history record just saved; `extra` holds answer text the
 * record does not keep, for example `{ game, correctAnswer, yourAnswer, more: [[label, text]] }`; `more` lines show
 * only after a wrong answer. Returns
 * `{ result: 'correct' | 'incorrect' | 'timeout', kicker, title, lines: [[label, text], ...], durationMs }`.
 */
export function answerToastContent(record, extra = {}) {
  const result = record.outcome === 'Correct' ? 'correct' : record.outcome === 'Timed Out' ? 'timeout' : 'incorrect';
  // Most games save only `gameType` ("Number memory"), so the game is matched from that name when `game` is missing.
  const game = extra.game ?? record.game ?? Object.keys(GAME_NAMES)
    .find((key) => GAME_NAMES[key].toLowerCase() === String(record.gameType ?? '').toLowerCase()) ?? 'cash';
  const kicker = `${GAME_NAMES[game] ?? record.gameType ?? 'Quiz'} · Question ${record.questionNumber ?? '—'}`;
  const title = result === 'correct' ? 'Correct' : result === 'timeout' ? "Time's up — wrong" : 'Wrong';
  let correctAnswer = extra.correctAnswer;
  let yourAnswer = extra.yourAnswer;
  const more = [...(extra.more ?? [])];
  if (game === 'cash') {
    correctAnswer ??= record.expectedAnswer;
    yourAnswer ??= cashAnswerText(record.userAnswer, record.userDeclaredAmount);
    // With the cash builder on, the cash picked must match too, so a wrong round also shows the cash to give.
    if (result !== 'correct' && record.userCashBreakdown) more.push(['Cash to give', record.recommendedBreakdown], ['Your cash', `${record.userCashTotal} — ${record.userCashBreakdown}`]);
  } else if (game === 'memory') {
    correctAnswer ??= String(record.expectedAnswer ?? '').replace(/^Values:\s*/, '');
    yourAnswer ??= record.userAnswer || 'No entry';
  } else if (game === 'typing') {
    correctAnswer ??= record.expectedAnswer;
    yourAnswer ??= record.userAnswer || '(empty)';
    if (Number.isFinite(record.wpm)) more.push(['Speed', `${record.wpm.toFixed(1)} WPM · ${record.accuracyPercent}% character accuracy`]);
  } else {
    correctAnswer ??= record.expectedAnswer;
    yourAnswer ??= record.userAnswer;
  }
  // An exact typing match repeats the whole passage, so a correct typing round shows only its speed.
  const lines = result === 'correct'
    ? (game === 'typing' ? more.filter(([label]) => label === 'Speed') : [['Your answer', yourAnswer]])
    : [['Correct answer', correctAnswer], ...(result === 'timeout' ? [] : [['Your answer', yourAnswer]]), ...more];
  return {
    result, kicker, title,
    lines: lines.filter(([, text]) => text !== undefined && text !== null && String(text).trim() !== '')
      .map(([label, text]) => [label, shortenToastText(text)]),
    durationMs: result === 'correct' ? ANSWER_TOAST_CORRECT_MS : ANSWER_TOAST_WRONG_MS,
  };
}
