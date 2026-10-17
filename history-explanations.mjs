// Plain-language "What this shows" notes for History charts and tables.
// Short sentences, simple words. Every chart and table gets one, specific or generic.

const METRICS = Object.freeze({
  accuracy: ['Accuracy (%)', 'Out of every 100 tries, how many were fully right. Higher is better.'],
  time: ['Time (seconds)', 'How long you took to answer, on average. Lower is faster.'],
  attempts: ['Attempts', 'How many tries are in this group.'],
  'error-rate': ['Error rate (%)', 'Out of every 100 chances to make a mistake, how many were mistakes. Lower is better.'],
  'percentage-error': ['Percentage off (%)', 'How far a wrong number was from the right one, as a share of the right one. Lower is better.'],
  selections: ['Marks to fix', 'How many marks you would need to add or remove to get it fully right. Lower is better.'],
  actions: ['Actions', 'How many clicks or moves this took.'],
  cents: ['Cents off', 'How far your answer was from the right amount, in cents. Lower is better.'],
  digits: ['Digits', 'How many digits were wrong, missing, or extra. Lower is better.'],
  WPM: ['WPM', 'Words per minute. One word counts as five typed characters. Higher is faster.'],
  '%': ['Percent', 'A share out of 100.'],
});

const OUTCOME_TERMS = Object.freeze([
  ['Correct', 'You gave the right answer in time.'],
  ['Incorrect', 'You answered, but the answer was wrong.'],
  ['Timed out', 'The timer ran out before you answered.'],
  ['Not answered', 'The question was shown, but you left before answering.'],
]);

const CHARTS = Object.freeze({
  outcomes: ['How your answers ended: right, wrong, out of time, or skipped.', OUTCOME_TERMS],
  'accuracy-by-difficulty': ['How often you were right at each level. Each row is one level, and the number at the end of the row belongs to that bar.', [
    ['Accuracy (%)', 'Out of every 100 tries at that level, how many were right.'],
    ['(47 of 60 correct)', 'Right answers, then all tries at that level. The rows add up to the total above the chart.'],
    ['Points', 'Number memory gives part credit, so its rows count points instead of right answers.'],
  ]],
  'accuracy-over-time': ['Whether you are getting more answers right from day to day.', [['Each point', 'One day with practice.']]],
  'response-time-over-time': ['Whether you are getting faster from day to day.', [['Each point', 'Your average answer time on one day.']]],
  'attempts-per-day': ['How much you practiced on each day.', []],
  'speed-vs-accuracy': ['Whether going faster costs you right answers. Each dot is one level.', [['Across', 'Average answer time.'], ['Up', 'Accuracy at that level.']]],
  'accuracy-by-response-band': ['How often you were right when you answered fast versus slow.', [['Time bands', 'Groups of answers by how many seconds they took.']]],
  'performance-distribution': ['How your answer times are spread out.', [['Each bar', 'How many answers took that long.']]],
  'best-vs-recent': ['Your first 20 tries next to your latest 20, to show change over time.', []],
  'weakest-variables': ['The conditions where you make the most mistakes, compared with your usual result.', []],
  'strongest-variables': ['The conditions where you do best, compared with your usual result.', []],
  'typing-speed': ['How fast you type over time.', []],
  'typing-character-accuracy': ['How many typed characters matched the prompt, over time.', []],
  'cash-error-reasons': ['Why cash answers were wrong, grouped by the likely cause.', []],
  'cash-builder-actions': ['How many clicks you used to build the cash, for right and wrong answers.', []],
  'cash-workload': ['How much adding and multiplying a question needs, figured out from the bills and coins. It is an estimate, not a record of what you did in your head.', []],
  'memory-partial-recall': ['How much of each number you remembered, even when it was not fully right.', []],
  'memory-mismatch-position': ['Where in the number your mistakes happen most often.', []],
  'error-missed-versus-false': ['Mistakes you missed next to things you marked that were fine.', [['Missed', 'A real mistake you did not mark.'], ['False flag', 'You marked something that was fine.']]],
  'fraud-issue-detection': ['For each kind of problem, how often you found it when it was really there.', []],
  'fraud-false-flags': ['For each kind of problem, how often you marked it when it was not there. Lower is better.', []],
  'chess-outcomes': ['How your chess games ended: wins, draws, and losses.', []],
  'chess-mistakes': ['How many of your moves the engine rated as mistakes.', []],
});

/** Explanation for one chart spec: { what, terms: [[term, meaning], ...] }. */
export function chartExplanation(spec) {
  const metric = spec?.series?.[0]?.metric ?? 'accuracy';
  const [specific, specificTerms] = CHARTS[spec?.id] ?? [];
  const metricTerm = METRICS[metric];
  const what = specific ?? `${spec?.title ?? 'This chart'}: each bar or point is one group of your tries${metricTerm ? `, measured as ${metricTerm[0].toLowerCase()}` : ''}.`;
  const terms = [...(specificTerms ?? [])];
  if (metricTerm && !terms.some(([term]) => term === metricTerm[0])) terms.push(metricTerm);
  if (spec?.kind === 'line' && !terms.some(([term]) => term === 'Each point')) terms.push(['Each point', 'One day or one try, in time order.']);
  return { what, terms };
}

export function summaryChartExplanation(id) {
  const [what, terms] = CHARTS[id];
  return { what, terms };
}

const COLUMNS = Object.freeze({
  when: 'The date and time of the try.', date: 'The date and time of the try.', game: 'Which game it was.',
  level: 'The difficulty you picked.', difficulty: 'The difficulty you picked.', result: 'Right, wrong, out of time, or not answered.',
  time: 'Seconds you took to answer.', expected: 'The right answer.', 'raw-input mistakes': 'Which typed or clicked parts were wrong.',
  'numeric error': 'How far a wrong number was from the right one.', outcome: 'Right, wrong, out of time, or not answered.',
  answers: 'How many answers are in this row.', share: 'This row as a part of all answers, out of 100.',
  accuracy: 'Out of every 100 tries, how many were right.', 'scored attempts': 'Tries that could be scored.',
  'points / correct': 'Right answers, or points when part credit is given.', category: 'The group this row is about.',
  value: 'The number the chart shows for this group.', evidence: 'How many tries the number is based on.',
  '95% interval': 'The likely true range. A wide range means there is not much data yet.',
  'error rate': 'Out of every 100 chances, how many were mistakes.', errors: 'How many mistakes.',
  opportunities: 'How many chances there were to make that mistake.', attempts: 'How many tries.',
  mode: 'The way the round was played.', score: 'Your points for the run.', duration: 'How long the run lasted.',
  'peak tasks': 'The most tasks open at the same time.', 'action accuracy': 'Out of every 100 actions, how many were right.',
  response: 'Average seconds to respond.', task: 'Which mini-task.', 'wpm / cpm': 'Words and characters typed per minute.',
  'character accuracy': 'Out of every 100 typed characters, how many matched.', 'expected text': 'The text you were asked to type.',
  'your text': 'What you typed.', session: 'Which practice session the try belongs to.', attempt: 'The try number.',
  details: 'Extra facts saved with the try.',
});

/** Explanation for a data table built from its column headers. */
export function tableExplanation(label, headers = []) {
  const terms = headers.map((header) => [header, COLUMNS[header.trim().toLowerCase()]]).filter(([, meaning]) => meaning);
  const what = `${label || 'This table'}: each row is one record. Use the column notes below to read the numbers.`;
  return { what, terms };
}

/** A small info toggle: closed by default, opens to show the explanation. */
export function createExplanation({ what, terms = [] }, label = 'What this shows') {
  const details = document.createElement('details');
  details.className = 'explanation';
  const summary = document.createElement('summary');
  summary.innerHTML = '<span class="explanation-icon" aria-hidden="true">i</span>';
  summary.append(document.createTextNode(label));
  const text = document.createElement('p');
  text.textContent = what;
  details.append(summary, text);
  if (terms.length) {
    const list = document.createElement('dl');
    for (const [term, meaning] of terms) {
      const dt = document.createElement('dt'); dt.textContent = term;
      const dd = document.createElement('dd'); dd.textContent = meaning;
      list.append(dt, dd);
    }
    details.append(list);
  }
  return details;
}
