import { HOLDS_GAME, HOLDS_GAME_NAME, HOLDS_PRESETS, TOPICS, CATEGORIES, resolveHoldsSettings, createHoldsRound, scoreHoldsAnswer, summarizeHoldsHistory } from './holds-verification.mjs?v=20261025-holds';
import { isTextEntry } from './numpad-shortcuts.mjs?v=20261025-keypad';

const el = (tag, text, cls) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (cls) node.className = cls; return node; };
const button = (text, action, cls = 'secondary-button') => { const node = el('button', text, cls); node.type = 'button'; node.addEventListener('click', action); return node; };
const clockText = (seconds) => { const whole = Math.max(0, Math.ceil(seconds)); return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`; };

/** Setup controls, the question screen and the round summary for Holds & Verification. */
export function createHoldsVerificationUI({ showScreen, onSave, onHistory, onSetup, getDifficulty }) {
  const setup = document.getElementById('holds-setup-options');
  const screen = document.getElementById('holds-verification-screen');
  const fields = {};
  const field = (id, label, input) => { const wrap = el('label', label); input.id = `holds-${id}`; wrap.append(input); fields[id] = input; return wrap; };
  const topic = el('select'); for (const [value, label] of Object.entries(TOPICS)) topic.append(new Option(label, value));
  const count = el('input'); count.type = 'number'; count.min = 1; count.max = 100;
  const seconds = el('input'); seconds.type = 'number'; seconds.min = 10; seconds.max = 300;
  const grid = el('div', undefined, 'form-grid');
  grid.append(field('topic', 'Question topic', topic), field('question-count', 'Questions', count), field('time-limit', 'Seconds per question', seconds));
  const presetNote = el('p', '', 'setup-note');
  setup.append(el('p', 'Multiple-choice questions on Reg CC hold types, Next-Day and Non-Next-Day items, release days, Xperience reasons, and teller verification steps. Distractors use real rules applied to the wrong case, so read every fact. Keys 1–5 pick an answer; Enter goes on.', 'setup-note'), grid, presetNote);

  let appliedDifficulty = null;
  // Presets fill the fields only when the difficulty changes, so typed counts survive other setup refreshes.
  function applyDifficulty(difficulty) {
    if (difficulty === appliedDifficulty) return;
    appliedDifficulty = difficulty;
    const preset = HOLDS_PRESETS[difficulty] ?? HOLDS_PRESETS.Easy;
    count.value = String(preset.questionCount); seconds.value = String(preset.timeLimitSeconds);
    presetNote.textContent = `${difficulty in HOLDS_PRESETS ? difficulty : 'Easy'}: ${preset.optionCount} choices per question, ${preset.questionCount} questions, ${preset.timeLimitSeconds}s each. Medium adds full release schedules and step order; Hard adds exceptions, joint accounts, aggregate deposits and “which is FALSE”.`;
  }
  const readSettings = () => resolveHoldsSettings({ difficulty: getDifficulty(), topic: topic.value, questionCount: count.value, timeLimitSeconds: seconds.value });
  function applySettings(saved = {}) {
    if (saved.topic && Object.hasOwn(TOPICS, saved.topic)) topic.value = saved.topic;
    if (saved.questionCount) count.value = String(saved.questionCount);
    if (saved.timeLimitSeconds) seconds.value = String(saved.timeLimitSeconds);
  }

  const header = el('div', undefined, 'screen-title-row');
  const progress = el('p', '', 'eyebrow'); progress.id = 'holds-progress';
  const timer = el('time', '', 'timer'); timer.id = 'holds-timer'; timer.setAttribute('aria-label', 'Time remaining for this question');
  header.append(progress, timer);
  const category = el('p', '', 'holds-category'); category.id = 'holds-category';
  const prompt = el('h2', '', 'holds-prompt'); prompt.id = 'holds-prompt'; prompt.tabIndex = -1;
  const facts = el('ul', undefined, 'holds-facts'); facts.id = 'holds-facts';
  const options = el('div', undefined, 'holds-options'); options.id = 'holds-options'; options.setAttribute('role', 'group'); options.setAttribute('aria-labelledby', 'holds-prompt');
  const feedback = el('section', undefined, 'holds-feedback'); feedback.id = 'holds-feedback'; feedback.hidden = true; feedback.setAttribute('role', 'status');
  const verdict = el('p', '', 'holds-verdict'), answerLine = el('p', '', 'holds-answer'), explanation = el('p', '', 'holds-explanation'), source = el('p', '', 'setup-note');
  const next = button('Next question', () => advance(), 'primary-button'); next.id = 'holds-next';
  feedback.append(verdict, answerLine, explanation, source, next);
  const controls = el('div', undefined, 'holds-controls');
  const endRound = button('End round', () => finish(true), 'text-button'); endRound.id = 'holds-end';
  controls.append(endRound);
  const play = el('div', undefined, 'holds-play'); play.append(header, category, prompt, facts, options, feedback, controls);
  const result = el('section', undefined, 'holds-result'); result.id = 'holds-result'; result.hidden = true;
  screen.append(play, result);

  let settings = null, round = [], index = 0, results = [], sessionId = '', shownAt = 0, ticker = null, answered = false, active = false;

  function stopTicker() { window.clearInterval(ticker); ticker = null; }
  function record(question, outcome, seconds, extra = {}) {
    return {
      game: HOLDS_GAME, gameType: HOLDS_GAME_NAME, sessionId, attemptId: `${sessionId}:${index + 1}`, questionNumber: index + 1,
      timestamp: new Date().toISOString(), difficulty: settings.difficulty, sessionMode: TOPICS[settings.topic], outcome,
      timeUsedSeconds: Number(seconds.toFixed(1)), timeLimitSeconds: settings.timeLimitSeconds,
      expectedAnswer: question.options.find((option) => option.id === question.correctOptionId).text, userAnswer: '',
      holdsTopicSetting: settings.topic, holdsCategory: question.category, holdsCategoryLabel: question.categoryLabel, holdsTopic: question.topic,
      holdsTemplate: question.template, holdsQuestionKey: question.key, holdsPrompt: question.prompt, holdsFacts: question.facts,
      holdsOptionCount: question.options.length, ...extra,
    };
  }
  function show() {
    const question = round[index];
    answered = false; feedback.hidden = true;
    progress.textContent = `Question ${index + 1} of ${round.length} · ${settings.difficulty.toUpperCase()}`;
    category.textContent = `${question.categoryLabel} · ${question.topic === 'verification' ? 'Verification' : question.topic === 'holds' ? 'Holds' : 'Mixed rules'}`;
    prompt.textContent = question.prompt;
    facts.replaceChildren(...question.facts.map((fact) => el('li', fact)));
    facts.hidden = !question.facts.length;
    options.replaceChildren(...question.options.map((option, position) => {
      const choice = button('', () => answer(option.id), 'holds-option');
      choice.dataset.optionId = option.id;
      choice.append(el('kbd', String(position + 1)), el('span', option.text));
      return choice;
    }));
    shownAt = performance.now();
    onSave(record(question, 'Not answered', 0), results);
    stopTicker();
    const tick = () => {
      const left = settings.timeLimitSeconds - (performance.now() - shownAt) / 1000;
      timer.textContent = clockText(left);
      if (left <= 0) answer(null, true);
    };
    tick(); ticker = window.setInterval(tick, 250);
    window.setTimeout(() => options.querySelector('button')?.focus({ preventScroll: true }), 0);
  }
  function answer(optionId, timedOut = false) {
    if (answered || !active) return;
    answered = true; stopTicker();
    const question = round[index];
    const seconds = Math.min(settings.timeLimitSeconds, (performance.now() - shownAt) / 1000);
    const score = scoreHoldsAnswer(question, optionId, timedOut);
    const saved = record(question, score.outcome, seconds, { userAnswer: score.selectedText, holdsSelectedOption: optionId ?? '' });
    results.push(saved);
    onSave(saved, results);
    for (const choice of options.querySelectorAll('button')) {
      choice.disabled = true;
      choice.classList.toggle('holds-option-correct', choice.dataset.optionId === question.correctOptionId);
      choice.classList.toggle('holds-option-wrong', choice.dataset.optionId === optionId && !score.correct);
    }
    verdict.textContent = score.correct ? '✓ Correct' : timedOut ? '⏱ Time ran out' : '✗ Not quite';
    verdict.className = `holds-verdict ${score.correct ? 'is-correct' : 'is-wrong'}`;
    answerLine.textContent = score.correct ? `Answer: ${score.correctText}` : `${optionId ? `You chose: ${score.selectedText}. ` : ''}Correct answer: ${score.correctText}`;
    explanation.textContent = question.explanation;
    source.textContent = `Source: ${question.source}`;
    next.textContent = index + 1 < round.length ? 'Next question' : 'See results';
    feedback.hidden = false;
    window.setTimeout(() => next.focus({ preventScroll: true }), 0);
  }
  function advance() {
    if (!answered) return;
    index += 1;
    if (index < round.length) show(); else finish(false);
  }
  function finish(stoppedEarly) {
    if (!active) return;
    active = false; stopTicker();
    play.hidden = true; result.hidden = false;
    const correct = results.filter((row) => row.outcome === 'Correct').length;
    const times = results.map((row) => row.timeUsedSeconds);
    const summary = summarizeHoldsHistory(results);
    result.replaceChildren(el('h2', `${HOLDS_GAME_NAME} results`));
    const facts = el('dl', undefined, 'holds-result-facts');
    for (const [term, value] of [['Score', `${correct} of ${results.length}${stoppedEarly ? ` (ended early, ${round.length} planned)` : ''}`],
      ['Accuracy', results.length ? `${Math.round(correct / results.length * 100)}%` : '—'],
      ['Average answer time', times.length ? `${(times.reduce((sum, value) => sum + value, 0) / times.length).toFixed(1)}s` : '—'],
      ['Difficulty · topic', `${settings.difficulty} · ${TOPICS[settings.topic]}`]]) {
      const row = el('div'); row.append(el('dt', term), el('dd', value)); facts.append(row);
    }
    result.append(facts);
    if (summary.categories.length) {
      result.append(el('h3', 'By question type'));
      const list = el('ul', undefined, 'holds-result-categories');
      for (const group of summary.categories) list.append(el('li', `${group.label}: ${group.correct} of ${group.answered} right (${group.accuracyPercent}%)`));
      result.append(list);
    }
    const missed = results.filter((row) => row.outcome !== 'Correct');
    if (missed.length) {
      result.append(el('h3', 'Review these'));
      const list = el('ol', undefined, 'holds-result-missed');
      for (const row of missed) list.append(el('li', `${row.holdsPrompt}${row.holdsFacts?.length ? ` (${row.holdsFacts.join('; ')})` : ''} → ${row.expectedAnswer}`));
      result.append(list);
    }
    const actions = el('div', undefined, 'button-row');
    const again = button('Another round', () => start(), 'primary-button'); again.id = 'holds-again';
    const history = button('History / Progress', () => onHistory()); history.id = 'holds-history';
    const back = button('Back to setup', () => onSetup(), 'text-button');
    actions.append(again, history, back);
    result.append(actions);
    window.setTimeout(() => again.focus({ preventScroll: true }), 0);
  }
  function start() {
    settings = readSettings();
    round = createHoldsRound(settings);
    index = 0; results = []; active = true;
    sessionId = `holds-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    play.hidden = false; result.hidden = true;
    showScreen('holds-verification');
    show();
  }
  function stop() { if (active) finish(true); stopTicker(); }

  document.addEventListener('keydown', (event) => {
    if (screen.hidden || !active || event.ctrlKey || event.altKey || event.metaKey || event.repeat || isTextEntry(event.target)) return;
    const digit = /^(Digit|Numpad)([1-9])$/.exec(event.code ?? '')?.[2] ?? (/^[1-9]$/.test(event.key) ? event.key : null);
    if (!answered && digit) {
      const choice = options.querySelectorAll('button')[Number(digit) - 1];
      if (choice) { event.preventDefault(); choice.click(); }
    } else if (answered && (event.key === 'Enter' || event.code === 'NumpadEnter') && event.target !== next) {
      event.preventDefault(); advance();
    }
  });

  return {
    start, stop, applyDifficulty, applySettings, readSettings,
    get settings() { return settings ?? readSettings(); },
    get active() { return active; },
    recommendation: (history) => summarizeHoldsHistory(history).recommendation,
    categories: CATEGORIES,
  };
}
