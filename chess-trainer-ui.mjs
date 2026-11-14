// Chess trainer screen: plan, lessons (idea -> animated demo -> quiz), flash drills,
// read-ahead drills, quick analysis (puzzles or engine positions from your games) and mistake review.
import { Chess } from './chess-core.mjs';
import { ChessBoard } from './chess-board.mjs?v=20261114-real';
import {
  TRAINER_CONCEPTS, TRACKS, TRACK_NOTES, FLASH_LEVELS, PLAN_STAGES, conceptById, lessonQuiz, flashDeck, analysisDeck,
  readAheadQuestion, mistakeQueue, dailyWorkout, refutation, readStats, writeStats, recordAnswer, recordRun, recordLesson,
  planProgress, nextStage, modeSummary, weakestConcepts, withShuffledChoices, shuffle,
} from './chess-trainer.mjs?v=20261113-trainer';

const MODE_NAMES = { lesson: 'Lesson quiz', flash: 'Flash drill', read: 'Read ahead', analysis: 'Quick analysis', mistakes: 'Mistake review', workout: 'Daily workout' };
const TABS = [['plan', 'Game plan'], ['lessons', 'Lessons'], ['flash', 'Flash'], ['read', 'Read ahead'], ['analysis', 'Quick analysis'], ['mistakes', 'Mistakes']];
const pct = value => value === null || value === undefined ? '—' : `${Math.round(value * 100)}%`;
const uci = move => ({ from: move.slice(0, 2), to: move.slice(2, 4), ...(move.length > 4 ? { promotion: move[4] } : {}) });

function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) if (child !== null && child !== undefined && child !== false) node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  return node;
}
const button = (label, onClick, className = 'secondary-button', props = {}) => h('button', { type: 'button', class: className, onClick, ...props }, label);
const lineText = (fen, sans) => { const turn = new Chess(fen).turn(), start = Number(fen.split(' ')[5] ?? 1); return sans.map((san, i) => { const ply = i + (turn === 'b' ? 1 : 0); const num = start + Math.floor(ply / 2); return ply % 2 === 0 ? `${num}. ${san}` : i === 0 ? `${num}… ${san}` : san; }).join(' '); };

export function createChessTrainer({ root, storage = globalThis.localStorage, engine = null, ensureEngine = async () => false, getGames = () => [], getOpenings = () => [], onPlay = () => {}, onClose = () => {}, applyBoardLook = () => {} }) {
  const el = id => document.getElementById(`chess-trainer-${id}`);
  const panel = el('panel');
  let tab = 'plan', run = null, lessonState = null, demoTimer = null, timer = null, selected = null, lastFocus = null;
  let stats = readStats(storage);
  const board = new ChessBoard(el('board'), selectSquare, { key: 'trainerSquare' });
  applyBoardLook(board);
  let display = new Chess();

  const save = () => { try { writeStats(stats, storage); } catch { el('summary').textContent = 'Training progress could not be saved on this device.'; } };
  const reviewedGames = () => { try { return getGames().filter(g => g.analysis?.status === 'complete').length; } catch { return 0; } };
  function showBoard(fen, { arrows = [], marks = [], lastMove = null, animate = false, caption = '' } = {}) {
    display = new Chess(fen ?? undefined);
    board.flipped = display.turn() === 'b';
    board.render(display, { selected, targets: selected ? display.moves({ square: selected, verbose: true }).map(m => m.to) : [], lastMove, animate });
    board.setArrows(arrows, marks);
    el('caption').textContent = caption || `${display.turn() === 'w' ? 'White' : 'Black'} to move`;
  }
  function stopTimers() { clearInterval(demoTimer); demoTimer = null; clearInterval(timer?.id); timer = null; el('timer').hidden = true; }
  function summaryLine() {
    const all = stats.answers.length, right = stats.answers.filter(a => a.correct).length;
    const done = TRAINER_CONCEPTS.filter(c => stats.lessons[c.id]?.completed).length;
    el('summary').textContent = `${done}/${TRAINER_CONCEPTS.length} lessons done · ${all} answers · ${all ? pct(right / all) : '—'} correct · ${mistakeQueue(stats).length} to review`;
  }
  function setTab(next) {
    stopTimers(); run = null; lessonState = null; selected = null; tab = next;
    for (const node of root.querySelectorAll('[data-trainer-tab]')) node.setAttribute('aria-selected', String(node.dataset.trainerTab === tab));
    summaryLine(); renderTab();
  }

  // ---------- tabs ----------
  function renderTab() {
    root.classList.toggle('trainer-menu', true);
    if (tab === 'plan') renderPlan();
    else if (tab === 'lessons') renderLessons();
    else if (tab === 'flash') renderFlashSetup();
    else if (tab === 'read') renderReadSetup();
    else if (tab === 'analysis') renderAnalysisSetup();
    else if (tab === 'mistakes') renderMistakesSetup();
  }
  function setPanel(...nodes) { panel.replaceChildren(...nodes); }
  function renderPlan() {
    showBoard('r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1', { arrows: [{ from: 'b5', to: 'c7', kind: 'good' }, { from: 'c7', to: 'e8', kind: 'line' }, { from: 'c7', to: 'a8', kind: 'line' }], caption: 'Every lesson shows ideas like this fork with arrows and moving pieces.' });
    const plan = planProgress(stats, { reviewedGames: reviewedGames() }), next = nextStage(stats, { reviewedGames: reviewedGames() });
    const weak = weakestConcepts(stats).filter(w => w.accuracy < 0.8);
    setPanel(
      h('div', { class: 'trainer-card trainer-hero' },
        h('h4', { text: 'Your game plan, start to finish' }),
        h('p', { text: next ? `Next step: ${next.title}. ${next.detail}` : 'Every stage is complete. Keep the daily workout going and raise the computer level.' }),
        h('div', { class: 'action-row' }, button('Start today’s workout (≈10 min)', startWorkout, 'primary-button', { id: 'chess-trainer-workout' }), next ? button(`Go to: ${next.title.replace(/^\d+\. /, '')}`, () => stageAction(next), 'secondary-button') : null)),
      h('ol', { class: 'trainer-plan' }, ...plan.map(stage => h('li', { class: stage.complete ? 'is-complete' : '' },
        h('div', { class: 'trainer-plan-head' }, h('strong', { text: `${stage.complete ? '✓ ' : ''}${stage.title}` }), h('span', { text: `${stage.done}/${stage.total}` })),
        h('div', { class: 'trainer-progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': stage.total, 'aria-valuenow': stage.done, 'aria-label': stage.title }, h('span', { style: `width:${Math.round(stage.done / stage.total * 100)}%` })),
        h('p', { text: stage.detail }), button(stage.id === 'play' ? 'Play the computer' : 'Open', () => stageAction(stage), 'text-button')))),
      weak.length ? h('div', { class: 'trainer-card' }, h('h4', { text: 'Work on these next' }), h('ul', {}, ...weak.map(w => h('li', {}, button(`${w.concept.title} · ${pct(w.accuracy)} correct`, () => startLesson(w.concept.id), 'text-button'))))) : null,
      h('details', { class: 'trainer-card trainer-howto' }, h('summary', { text: 'How to use the trainer' }),
        h('ol', {},
          h('li', { text: 'Lessons: read the idea in simple words, see when to use it and when not to, then watch the animated demo (Play, or Step one move at a time).' }),
          h('li', { text: 'Quiz: each lesson asks you to find the move or judge a scenario. A wrong answer shows why it fails and comes back at the end until you get it right.' }),
          h('li', { text: 'Flash: quick timed cards from every lesson, weighted toward the ideas you miss. Some cards ask you to name the idea behind a move.' }),
          h('li', { text: 'Read ahead: the board stays still while 2–4 moves are listed (or flashed). Picture them, then answer about the new position.' }),
          h('li', { text: 'Quick analysis: pick the best move from four under a timer — from the puzzle bank or from positions in your own games, checked by the engine.' }),
          h('li', { text: 'Answer with a click, the 1–4 keys, or by playing the move on the board. Enter goes to the next card. Esc returns to this plan.' }),
          h('li', { text: 'Finish by playing the computer with coaching on, then Analyze game. Wrong answers collect in Mistakes for review.' }))),
    );
  }
  function stageAction(stage) {
    if (stage.action.tab === 'play') { onPlay(); return; }
    setTab(stage.action.tab);
    if (stage.action.track) panel.querySelector(`[data-track-filter="${stage.action.track}"]`)?.click();
  }
  let trackFilter = 'All';
  function renderLessons() {
    showBoard('r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1', { caption: 'Pick a lesson. Each one: idea → animated demo → quiz.' });
    const grid = h('div', { class: 'trainer-lesson-grid', id: 'chess-trainer-lessons' });
    const draw = () => {
      grid.replaceChildren(...TRAINER_CONCEPTS.filter(c => trackFilter === 'All' || c.track === trackFilter).map(c => {
        const record = stats.lessons[c.id];
        return h('button', { type: 'button', class: `trainer-lesson-card${record?.completed ? ' is-complete' : ''}`, dataset: { concept: c.id }, onClick: () => startLesson(c.id) },
          h('span', { class: 'trainer-tag', text: c.track }),
          h('strong', { text: c.title }),
          h('small', { text: c.summary.split('. ')[0] + '.' }),
          h('span', { class: 'trainer-stars', 'aria-label': record?.completed ? `${record.stars} of 3 stars` : 'Not started', text: record?.completed ? '★'.repeat(record.stars) + '☆'.repeat(3 - record.stars) : `Level ${c.level}` }));
      }));
      for (const chip of filters.querySelectorAll('button')) chip.setAttribute('aria-pressed', String(chip.dataset.trackFilter === trackFilter));
    };
    const filters = h('div', { class: 'trainer-chips', role: 'group', 'aria-label': 'Filter lessons by track' }, ...['All', ...TRACKS].map(track => h('button', { type: 'button', class: 'text-button', dataset: { trackFilter: track }, onClick: () => { trackFilter = track; draw(); } }, track)));
    setPanel(h('div', { class: 'trainer-card' }, h('h4', { text: 'Lessons' }), h('p', { text: trackFilter === 'All' ? `${TRAINER_CONCEPTS.length} lessons in ${TRACKS.length} tracks. Start with Thinking.` : TRACK_NOTES[trackFilter] }), filters), grid);
    draw();
  }
  function setupCard(title, text, fields, startLabel, onStart, extra = null) {
    const form = h('form', { class: 'trainer-card trainer-setup', onSubmit: event => { event.preventDefault(); onStart(new FormData(form)); } },
      h('h4', { text: title }), h('p', { text }), h('div', { class: 'trainer-fields' }, ...fields), extra,
      h('div', { class: 'action-row' }, h('button', { type: 'submit', class: 'primary-button', id: 'chess-trainer-start' }, startLabel)));
    return form;
  }
  const select = (name, label, options, value) => h('label', {}, label, h('select', { name }, ...options.map(([v, t]) => { const o = h('option', { value: v }, t); if (String(v) === String(value)) o.selected = true; return o; })));
  const statLine = (mode, filter) => { const s = modeSummary(stats, mode, filter); return h('p', { class: 'trainer-stat', text: s.answered ? `So far: ${s.correct}/${s.answered} correct (${pct(s.accuracy)}) · best streak ${s.bestStreak}${s.averageSeconds ? ` · ${s.averageSeconds.toFixed(1)}s per answer` : ''}` : 'No answers yet.' }); };
  function renderFlashSetup() {
    showBoard('6k1/5ppp/8/8/8/8/8/R6K w - - 0 1', { arrows: [{ from: 'a1', to: 'a8', kind: 'good' }], caption: 'Flash: see it, name it, play it — fast.' });
    const tracks = h('fieldset', { class: 'trainer-tracks' }, h('legend', { text: 'Tracks' }), ...TRACKS.map(track => h('label', { class: 'toggle-row' }, h('input', { type: 'checkbox', name: 'track', value: track, checked: true }), h('span', { text: track }))));
    setPanel(setupCard('Flash drill', 'Rapid cards with a countdown. Hard adds mirrored positions and less time. Cards you miss come back more often.',
      [select('level', 'Level', Object.entries(FLASH_LEVELS).map(([name, c]) => [name, `${name} · ${c.seconds}s · ${c.count} cards`]), 'Medium')],
      'Start flash drill', data => {
        const level = data.get('level'), chosen = data.getAll('track');
        const deck = flashDeck({ level, tracks: chosen.length ? chosen : TRACKS, stats });
        startRun({ mode: 'flash', questions: deck.questions, seconds: deck.seconds, level });
      }, tracks), statLine('flash'));
  }
  function renderReadSetup() {
    showBoard('r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1', { caption: 'Read ahead: the board will not move. Picture the moves.' });
    setPanel(setupCard('Read ahead', 'The board shows the starting position. The next moves are only listed (or flashed and then hidden). Picture them, then answer a question about the new position.',
      [select('depth', 'Moves to picture', [[2, '2 half-moves (move + reply)'], [3, '3 half-moves'], [4, '4 half-moves']], 2),
        select('display', 'Show the moves', [['text', 'As text only (blindfold)'], ['flash', 'Flash them on the board, then hide']], 'text'),
        select('count', 'Questions', [[8, '8'], [12, '12'], [20, '20']], 8)],
      'Start reading ahead', data => {
        const depth = Number(data.get('depth')), count = Number(data.get('count')), questions = [], seen = new Set();
        for (let i = 0; i < count * 6 && questions.length < count; i++) { const q = readAheadQuestion({ depth, openings: getOpenings() }); if (q && !seen.has(q.id + q.ask)) { seen.add(q.id + q.ask); questions.push(q); } }
        startRun({ mode: 'read', questions, seconds: 12 + depth * 8, depth, display: data.get('display') });
      }), [2, 3, 4].map(d => h('div', {}, h('strong', { text: `${d} half-moves: ` }), statLine('read', a => a.depth === d))));
  }
  function renderAnalysisSetup() {
    showBoard('k7/1q6/8/8/8/5P2/2B5/6K1 w - - 0 1', { caption: 'Quick analysis: find the best move before the timer runs out.' });
    const games = (() => { try { return getGames().filter(g => g.moves?.length >= 8).length; } catch { return 0; } })();
    setPanel(setupCard('Quick analysis', 'Look at the board and choose the best of four moves. Puzzle bank positions have one clear answer. Positions from your games are scored by the engine: any move within 0.3 pawns of the best counts.',
      [select('source', 'Positions', [['bank', 'Puzzle bank (instant)'], ['games', `From my games, engine-checked (${games} games)`]], 'bank'),
        select('seconds', 'Time per position', [[20, '20 seconds'], [30, '30 seconds'], [60, '60 seconds'], [0, 'No timer']], 30),
        select('count', 'Positions', [[5, '5'], [10, '10'], [20, '20']], 10)],
      'Start quick analysis', data => {
        const count = Number(data.get('count')), seconds = Number(data.get('seconds'));
        if (data.get('source') === 'games' && games) startRun({ mode: 'analysis', questions: [], engineCount: count, seconds, source: 'games' });
        else startRun({ mode: 'analysis', questions: analysisDeck({ count }), seconds, source: 'bank', note: data.get('source') === 'games' ? 'No saved games with 8+ moves yet, so the puzzle bank is used.' : '' });
      }), statLine('analysis'));
  }
  function renderMistakesSetup() {
    const queue = mistakeQueue(stats);
    showBoard(queue[0]?.fen ?? '4k3/8/8/8/8/8/8/4K3 w - - 0 1', { caption: queue.length ? 'Your first mistake to review.' : 'No mistakes waiting.' });
    setPanel(h('div', { class: 'trainer-card' }, h('h4', { text: 'Mistake review' }),
      h('p', { text: queue.length ? `${queue.length} card${queue.length === 1 ? '' : 's'} you answered wrong last time. Get each one right to clear it.` : 'Nothing to review. Wrong answers from any mode land here.' }),
      queue.length ? h('ul', { class: 'trainer-mistakes' }, ...queue.slice(0, 12).map(q => h('li', { text: `${conceptById(q.concept)?.title ?? 'Puzzle'}: ${q.ask}` }))) : null,
      h('div', { class: 'action-row' }, queue.length ? button('Review mistakes', () => startRun({ mode: 'mistakes', questions: shuffle(queue).map(q => withShuffledChoices(q)), seconds: 0, requeue: true }), 'primary-button', { id: 'chess-trainer-start' }) : null)), statLine('mistakes'));
  }

  // ---------- lessons ----------
  function startLesson(id) {
    stopTimers(); const item = conceptById(id); if (!item) return;
    tab = 'lessons'; run = null; selected = null;
    lessonState = { item, phase: 'intro', step: 0 };
    root.classList.remove('trainer-menu');
    renderLessonIntro();
  }
  function renderLessonIntro() {
    const { item } = lessonState;
    showBoard(item.demo.fen, { caption: `${item.title} — starting position` });
    setPanel(h('div', { class: 'trainer-card trainer-lesson' },
      h('p', { class: 'trainer-tag', text: `${item.track} · level ${item.level}` }), h('h4', { id: 'chess-trainer-lesson-title', text: item.title }),
      h('p', { class: 'trainer-big', text: item.summary }),
      h('div', { class: 'trainer-when' },
        h('div', { class: 'trainer-yes' }, h('strong', { text: 'Use it when' }), h('ul', {}, ...item.when.map(t => h('li', { text: t })))),
        h('div', { class: 'trainer-no' }, h('strong', { text: 'Do not use it when' }), h('ul', {}, ...item.whenNot.map(t => h('li', { text: t }))))),
      h('div', { class: 'action-row' }, button('Watch the demo ▶', () => startDemo(true), 'primary-button', { id: 'chess-trainer-demo' }), button('Skip to quiz', startLessonQuiz, 'text-button'), button('All lessons', () => setTab('lessons'), 'text-button'))));
    focusFirst();
  }
  function demoArrows(fen, san) {
    const chess = new Chess(fen), move = chess.move(san), arrows = [{ from: move.from, to: move.to, kind: 'good' }];
    // Show what the moved piece now attacks when it is a forcing move.
    if (move.san.includes('+') || move.captured) {
      const king = chess.board().flat().find(p => p && p.type === 'k' && p.color === chess.turn());
      if (move.san.includes('+') && king) arrows.push({ from: move.to, to: king.square, kind: 'line' });
    }
    for (const target of new Chess(chess.fen().replace(/ [wb] /, ` ${move.color} `)).moves({ square: move.to, verbose: true }).filter(m => m.captured && m.captured !== 'p').slice(0, 2)) arrows.push({ from: move.to, to: target.to, kind: 'line' });
    return { chess, move, arrows };
  }
  function startDemo(autoplay) {
    stopTimers(); lessonState.phase = 'demo'; lessonState.step = 0; lessonState.fen = lessonState.item.demo.fen;
    renderDemo(); if (autoplay) toggleDemo();
  }
  function demoStep() {
    const { item } = lessonState;
    if (lessonState.step >= item.demo.steps.length) { clearInterval(demoTimer); demoTimer = null; renderDemo(); return; }
    const step = item.demo.steps[lessonState.step], { chess, move, arrows } = demoArrows(lessonState.fen, step.san);
    lessonState.fen = chess.fen(); lessonState.step++; lessonState.arrows = arrows;
    display = chess; board.flipped = new Chess(item.demo.fen).turn() === 'b';
    board.render(chess, { lastMove: move, animate: true }); board.setArrows(arrows);
    el('caption').textContent = `${move.color === 'w' ? 'White' : 'Black'} plays ${move.san}`;
    renderDemo();
  }
  function toggleDemo() {
    if (demoTimer) { clearInterval(demoTimer); demoTimer = null; renderDemo(); return; }
    if (lessonState.step >= lessonState.item.demo.steps.length) { lessonState.step = 0; lessonState.fen = lessonState.item.demo.fen; showBoard(lessonState.fen); }
    demoStep(); demoTimer = setInterval(demoStep, 2600); renderDemo();
  }
  function renderDemo() {
    const { item, step } = lessonState, done = step >= item.demo.steps.length;
    const notes = h('ol', { class: 'trainer-demo-notes' }, ...item.demo.steps.map((s, i) => h('li', { class: i === step - 1 ? 'is-current' : i < step ? 'is-past' : 'is-future', 'aria-current': i === step - 1 ? 'step' : null }, h('strong', { text: s.san }), ' ', i < step ? s.note : '…')));
    setPanel(h('div', { class: 'trainer-card trainer-lesson' },
      h('p', { class: 'trainer-tag', text: `Demo · ${step}/${item.demo.steps.length}` }), h('h4', { text: item.title }),
      h('p', { class: 'trainer-big', role: 'status', text: step ? item.demo.steps[step - 1].note : 'Press Play to watch, or Step to go one move at a time.' }), notes,
      h('div', { class: 'action-row' },
        button(demoTimer ? 'Pause ❚❚' : done ? 'Replay ↺' : 'Play ▶', toggleDemo, 'secondary-button', { id: 'chess-trainer-demo-play' }),
        button('Step ›', () => { clearInterval(demoTimer); demoTimer = null; demoStep(); }, 'secondary-button', { id: 'chess-trainer-demo-step', disabled: done }),
        button('Start the quiz', startLessonQuiz, done ? 'primary-button' : 'text-button', { id: 'chess-trainer-quiz' }))));
  }
  function startLessonQuiz() {
    stopTimers();
    const item = lessonState.item;
    startRun({ mode: 'lesson', concept: item.id, questions: lessonQuiz(item.id), seconds: 0, requeue: true });
  }
  function startWorkout() { startRun({ mode: 'workout', questions: dailyWorkout({ stats, openings: getOpenings() }), seconds: 25 }); }

  // ---------- runs (any quiz) ----------
  function startRun(config) {
    stopTimers(); root.classList.remove('trainer-menu');
    run = { ...config, index: 0, score: 0, total: 0, streak: 0, bestStreak: 0, firstTry: 0, missed: new Set(), wrong: [], answered: null, times: [] };
    if (config.mode === 'analysis' && config.source === 'games') { run.questions = []; void loadEngineQuestion(); return; }
    if (!run.questions.length) { setPanel(h('div', { class: 'trainer-card' }, h('p', { text: 'No questions available for these settings.' }), button('Back', () => setTab(tab), 'secondary-button'))); return; }
    showQuestion();
  }
  const current = () => run?.questions[run.index];
  function showQuestion() {
    const q = current(); if (!q) { finishRun(); return; }
    run.answered = null; run.startedAt = performance.now(); selected = null;
    const fallbackFen = conceptById(q.concept)?.demo.fen;
    const marks = q.kind === 'read' && q.origin ? [{ square: q.origin, kind: 'hint' }] : [];
    showBoard(q.fen ?? fallbackFen, { marks, caption: q.fen ? `${new Chess(q.fen).turn() === 'w' ? 'White' : 'Black'} to move${q.mirrored ? ' · mirrored position' : ''}` : 'Idea question — the board shows the lesson position.' });
    if (q.kind === 'name' && q.showMove) { const { move, arrows } = demoArrows(q.fen, q.showMove); board.setArrows(arrows); el('caption').textContent = `Best move: ${move.san}`; }
    const choices = h('div', { class: 'trainer-choices', role: 'group', 'aria-label': 'Answer choices' }, ...q.choices.map((choice, i) => h('button', { type: 'button', class: 'trainer-choice', dataset: { choice }, onClick: () => answer(choice) }, h('kbd', { text: String(i + 1) }), h('span', { text: choice }))));
    const line = q.kind === 'read' ? h('p', { class: 'trainer-line', 'aria-label': 'Moves to picture' }, lineText(q.fen, q.line)) : null;
    const header = `${MODE_NAMES[run.mode]}${run.concept ? ` · ${conceptById(run.concept).title}` : ''} · ${run.index + 1}/${run.questions.length + (run.engineCount ? run.engineCount - run.questions.length : 0)}`;
    setPanel(h('div', { class: 'trainer-card trainer-question' },
      h('div', { class: 'trainer-qhead' }, h('span', { class: 'trainer-tag', text: header }), h('span', { class: 'trainer-streak', text: run.streak >= 2 ? `🔥 ${run.streak} in a row` : `Score ${run.score}/${run.total}` })),
      run.note ? h('p', { class: 'chart-note', text: run.note }) : null,
      line, h('p', { class: 'trainer-big', id: 'chess-trainer-ask', text: q.ask }),
      q.kind === 'move' ? h('p', { class: 'chart-note', text: 'Click a choice, press 1–4, or play the move on the board.' }) : null,
      choices, h('div', { id: 'chess-trainer-feedback', role: 'status' }),
      h('div', { class: 'action-row' }, button('Quit', () => { if (run.total) finishRun(); else setTab(tab); }, 'text-button'))));
    if (q.kind === 'read' && run.display === 'flash') void flashLine(q);
    if (run.seconds) startTimer(run.seconds + (q.kind === 'read' && run.display === 'flash' ? q.line.length * 0.7 : 0));
    focusFirst();
  }
  async function flashLine(q) {
    const id = q;
    let chess = new Chess(q.fen);
    for (const san of q.line) {
      await new Promise(r => setTimeout(r, 650)); if (current() !== id || run.answered) return;
      const move = chess.move(san); board.render(chess, { lastMove: move, animate: true }); board.setArrows([{ from: move.from, to: move.to, kind: 'hint' }]);
    }
    await new Promise(r => setTimeout(r, 900)); if (current() !== id || run.answered) return;
    chess = new Chess(q.fen); board.render(chess, {}); board.setArrows([], q.origin ? [{ square: q.origin, kind: 'hint' }] : []);
    el('caption').textContent = 'Hidden again — picture the moves.';
  }
  function startTimer(seconds) {
    clearInterval(timer?.id);
    const bar = el('timer'), fill = bar.firstElementChild, ends = performance.now() + seconds * 1000;
    bar.hidden = false;
    timer = { id: setInterval(() => {
      const left = Math.max(0, ends - performance.now());
      fill.style.width = `${left / (seconds * 1000) * 100}%`; bar.classList.toggle('is-low', left < 4000);
      bar.setAttribute('aria-valuenow', String(Math.ceil(left / 1000)));
      if (left <= 0) { clearInterval(timer.id); answer(null, { timedOut: true }); }
    }, 100) };
    bar.setAttribute('aria-valuemax', String(Math.ceil(seconds)));
  }
  function correctChoice(q, choice) { return q.accept ? q.accept.includes(choice) : choice === q.answer; }
  function answer(choice, { timedOut = false } = {}) {
    const q = current(); if (!q || run.answered) return;
    clearInterval(timer?.id); el('timer').hidden = true;
    const ms = performance.now() - run.startedAt, correct = choice !== null && correctChoice(q, choice);
    run.answered = { choice, correct }; run.total++; run.times.push(ms);
    if (correct) { run.score++; run.streak++; run.bestStreak = Math.max(run.bestStreak, run.streak); if (!run.missed.has(q.id)) run.firstTry++; }
    else { run.streak = 0; run.missed.add(q.id); run.wrong.push(q); if (run.requeue && run.questions.filter(x => x.id === q.id).length < 3) run.questions.push(withShuffledChoices(q)); }
    stats = recordAnswer(stats, { mode: run.mode === 'workout' ? (q.kind === 'read' ? 'read' : q.kind === 'move' ? 'analysis' : 'flash') : run.mode === 'lesson' ? 'lesson' : run.mode, question: q, correct, ms, timedOut });
    save(); summaryLine();
    for (const node of panel.querySelectorAll('.trainer-choice')) {
      node.disabled = true;
      if (correctChoice(q, node.dataset.choice)) node.classList.add('is-right');
      else if (node.dataset.choice === choice) node.classList.add('is-wrong');
    }
    const feedback = el('feedback'), parts = [];
    parts.push(h('p', { class: correct ? 'trainer-right' : 'trainer-wrong', text: correct ? pick(['Correct!', 'Nice — that’s it.', 'Right!', 'Well spotted.']) : timedOut ? `Time’s up. The answer was ${q.answer}.` : `Not quite. The answer is ${q.answer}.` }));
    parts.push(h('p', { text: q.why }));
    if (!correct && choice && (q.kind === 'move' || q.kind === 'read' && q.playable) && !q.evals) {
      const fen = q.finalFen && q.playable ? q.finalFen : q.fen, why = refutation(fen, choice);
      if (why) parts.push(h('p', { class: 'trainer-refute', text: `Why ${choice} fails: ${why.text}` }));
    }
    if (q.evals) parts.push(h('ul', { class: 'trainer-evals' }, ...q.evals.map(e => h('li', { text: `${e.san}: ${e.label}${e.san === q.played ? ' · you played this in your game' : ''}` }))));
    if (run.requeue && !correct) parts.push(h('p', { class: 'chart-note', text: 'This card will come back at the end.' }));
    parts.push(h('div', { class: 'action-row' }, button(run.index + 1 >= run.questions.length && !(run.engineCount > run.questions.length) ? 'See results (Enter)' : 'Next (Enter)', next, 'primary-button', { id: 'chess-trainer-next' })));
    feedback.replaceChildren(...parts);
    showAnswerOnBoard(q, choice, correct);
    el('next')?.focus();
  }
  function showAnswerOnBoard(q, choice, correct) {
    if (q.kind === 'read') {
      // Replay the line so you can check your picture, then show the result.
      let chess = new Chess(q.fen), i = 0;
      const step = () => {
        if (current() !== q) return;
        if (i < q.line.length) { const move = chess.move(q.line[i++]); board.render(chess, { lastMove: move, animate: true }); board.setArrows([{ from: move.from, to: move.to, kind: 'hint' }]); setTimeout(step, 520); return; }
        const marks = q.highlight ? [{ square: q.highlight, kind: correct ? 'good' : 'bad' }] : [];
        if (q.playable) { const after = new Chess(chess.fen()), move = after.move(q.answer); board.render(after, { lastMove: move, animate: true }); board.setArrows([{ from: move.from, to: move.to, kind: 'good' }], marks); chess = after; }
        else board.setArrows([], marks);
        el('caption').textContent = 'Position after the line';
      };
      step(); return;
    }
    if (!q.fen || !(q.kind === 'move' || q.kind === 'name' || /^([KQRBN]?[a-h]?x?[a-h][1-8]|O-O)/.test(q.answer))) return;
    if (q.check?.type === 'outpost') { board.setArrows([], [{ square: q.answer, kind: 'good' }, ...(!correct && choice ? [{ square: choice, kind: 'bad' }] : [])]); return; }
    try {
      const arrows = [];
      if (!correct && choice) { try { const m = new Chess(q.fen).move(choice); arrows.push({ from: m.from, to: m.to, kind: 'bad' }); } catch { /* not a move */ } }
      const after = new Chess(q.fen), move = after.move(q.answer);
      board.render(after, { lastMove: move, animate: true }); arrows.push({ from: move.from, to: move.to, kind: 'good' });
      board.setArrows(arrows); el('caption').textContent = `${move.color === 'w' ? 'White' : 'Black'} plays ${move.san}${after.isCheckmate() ? ' — checkmate' : ''}`;
    } catch { /* idea answers are not moves */ }
  }
  const pick = list => list[Math.floor(Math.random() * list.length)];
  function next() {
    if (!run) return;
    run.index++;
    if (run.mode === 'analysis' && run.source === 'games' && run.index >= run.questions.length && run.questions.length < run.engineCount) { void loadEngineQuestion(); return; }
    if (run.index >= run.questions.length) finishRun(); else showQuestion();
  }
  function finishRun() {
    stopTimers();
    const r = run; if (!r) return;
    const accuracy = r.total ? r.score / r.total : 0, unique = new Set(r.questions.map(q => q.id)).size;
    stats = recordRun(stats, { mode: r.mode, score: r.mode === 'lesson' || r.mode === 'mistakes' ? r.firstTry : r.score, total: r.mode === 'lesson' || r.mode === 'mistakes' ? unique : r.total, bestStreak: r.bestStreak, level: r.level ?? null, depth: r.depth ?? null, concept: r.concept ?? null });
    if (r.mode === 'lesson') stats = recordLesson(stats, r.concept, { correctFirstTry: r.firstTry, total: unique });
    save(); summaryLine();
    const average = r.times.length ? r.times.reduce((a, b) => a + b, 0) / r.times.length / 1000 : 0;
    const lessonRecord = r.mode === 'lesson' ? stats.lessons[r.concept] : null;
    const nextLesson = r.mode === 'lesson' ? TRAINER_CONCEPTS[TRAINER_CONCEPTS.findIndex(c => c.id === r.concept) + 1] : null;
    run = null;
    setPanel(h('div', { class: 'trainer-card trainer-result', id: 'chess-trainer-result' },
      h('p', { class: 'trainer-tag', text: MODE_NAMES[r.mode] }),
      h('h4', { text: r.mode === 'lesson' ? `Lesson complete ${'★'.repeat(lessonRecord.stars)}${'☆'.repeat(3 - lessonRecord.stars)}` : accuracy >= 0.8 ? 'Great run!' : accuracy >= 0.5 ? 'Good work — keep going.' : 'Tough one. Review and try again.' }),
      h('div', { class: 'metric-grid' },
        ...[[r.mode === 'lesson' || r.mode === 'mistakes' ? `${r.firstTry}/${unique}` : `${r.score}/${r.total}`, r.mode === 'lesson' || r.mode === 'mistakes' ? 'Right first try' : 'Correct'], [pct(r.total ? r.score / r.total : null), 'Accuracy'], [String(r.bestStreak), 'Best streak'], [`${average.toFixed(1)}s`, 'Per answer']]
          .map(([value, label]) => h('div', { class: 'metric' }, h('strong', { text: value }), h('span', { text: label })))),
      r.wrong.length ? h('details', {}, h('summary', { text: `${new Set(r.wrong.map(q => q.id)).size} to review` }), h('ul', {}, ...[...new Map(r.wrong.map(q => [q.id, q])).values()].map(q => h('li', { text: `${q.ask} — ${q.answer}` })))) : null,
      h('div', { class: 'action-row' },
        r.mode === 'lesson' ? button('Retry lesson', () => startLesson(r.concept), 'secondary-button') : button('Go again', () => setTab(r.mode === 'workout' ? 'plan' : r.mode === 'lesson' ? 'lessons' : r.mode), 'secondary-button'),
        nextLesson ? button(`Next lesson: ${nextLesson.title}`, () => startLesson(nextLesson.id), 'primary-button', { id: 'chess-trainer-next-lesson' }) : null,
        r.wrong.length && r.mode !== 'mistakes' ? button('Review mistakes', () => setTab('mistakes'), 'text-button') : null,
        button('Back to game plan', () => setTab('plan'), 'text-button'))));
    focusFirst();
  }

  // ---------- engine positions from your games ----------
  const scoreValue = score => !score ? null : score.type === 'mate' ? (score.value > 0 ? 100000 - score.value : -100000 - score.value) : score.value;
  const label = (loss, score) => score?.type === 'mate' ? (score.value > 0 ? `mate in ${score.value}` : `allows mate in ${-score.value}`) : loss <= 30 ? 'best or equal' : `${(loss / 100).toFixed(1)} pawns worse`;
  async function loadEngineQuestion() {
    const r = run;
    setPanel(h('div', { class: 'trainer-card' }, h('p', { role: 'status', text: 'The engine is checking a position from your games…' })));
    try {
      if (!engine || !(await ensureEngine())) throw new Error('engine');
      const games = getGames().filter(g => g.moves?.length >= 8);
      const game = games[Math.floor(Math.random() * games.length)];
      const turns = game.moves.map((m, i) => ({ m, i })).filter(({ m, i }) => i >= 4 && m.color === game.player);
      const { m: played } = turns[Math.floor(Math.random() * turns.length)] ?? { m: game.moves[game.moves.length - 2] };
      const fen = played.before, position = `position fen ${fen}`, chess = new Chess(fen);
      const best = await engine.search(position, `trainer:${fen}`, { skill: 20, budgetMs: 300 });
      if (run !== r) return;
      const bestSan = new Chess(fen).move(uci(best.move)).san;
      const legal = chess.moves({ verbose: true });
      const extras = shuffle(legal.filter(m => m.san !== bestSan && m.san !== played.san), Math.random).sort((a, b) => Number(Boolean(b.captured || b.san.includes('+'))) - Number(Boolean(a.captured || a.san.includes('+'))));
      const candidates = [...new Set([bestSan, played.san, ...extras.map(m => m.san)])].slice(0, 4);
      const evals = [];
      for (const san of candidates) {
        const move = new Chess(fen).move(san);
        const result = san === bestSan ? best : await engine.search(position, `trainer:${fen}:${san}`, { skill: 20, budgetMs: 300, searchMove: move.from + move.to + (move.promotion ?? '') });
        if (run !== r) return;
        evals.push({ san, score: result.score, value: scoreValue(result.score) });
      }
      const top = Math.max(...evals.map(e => e.value ?? -Infinity));
      for (const e of evals) { e.loss = top - (e.value ?? top); e.label = label(e.loss, e.score); }
      const accept = evals.filter(e => e.loss <= 30).map(e => e.san);
      r.questions.push({ id: `engine-${fen}`, kind: 'move', fen, ask: `From your game (${new Date(game.startedAt).toLocaleDateString()}). Find the best move for ${chess.turn() === 'w' ? 'White' : 'Black'}.`, choices: shuffle(candidates), answer: bestSan, accept, evals, played: played.san, why: `Engine (300 ms per move): ${bestSan} is best.${played.san !== bestSan ? ` In your game you played ${played.san}.` : ' You found it in your game too.'}` });
      showQuestion();
    } catch (error) {
      if (run !== r) return;
      r.source = 'bank'; r.note = 'The engine could not check your games right now, so the puzzle bank is used.';
      r.questions.push(...analysisDeck({ count: Math.max(1, r.engineCount - r.questions.length) })); r.engineCount = 0;
      showQuestion();
    }
  }

  // ---------- playing an answer on the board ----------
  function selectSquare(square) {
    const q = current();
    if (!square) { selected = null; board.render(display, {}); return; }
    // Read-ahead answers are about the hidden position, so only "find the move" cards take board input.
    if (!q || run.answered || q.kind !== 'move') return;
    const chess = new Chess(q.fen);
    if (selected) {
      const move = chess.moves({ square: selected, verbose: true }).find(m => m.to === square && (!m.promotion || m.promotion === 'q' || q.choices.some(c => c.includes(`=${m.promotion.toUpperCase()}`))));
      const options = chess.moves({ square: selected, verbose: true }).filter(m => m.to === square);
      if (options.length) {
        const chosen = options.find(m => q.choices.includes(m.san)) ?? move ?? options[0];
        selected = null; answer(chosen.san); return;
      }
    }
    selected = chess.get(square)?.color === chess.turn() ? square : null;
    board.render(chess, { selected, targets: selected ? chess.moves({ square: selected, verbose: true }).map(m => m.to) : [] });
  }

  function focusFirst() { requestAnimationFrame(() => (panel.querySelector('.primary-button, .trainer-choice:not(:disabled), button') ?? panel)?.focus({ preventScroll: true })); }
  function keydown(event) {
    if (root.hidden || event.defaultPrevented || event.target.closest?.('input, select, textarea, [contenteditable]')) return;
    if (event.key === 'Escape') { event.preventDefault(); if (run || lessonState) setTab(run?.mode === 'lesson' ? 'lessons' : tab); else onClose(); return; }
    if (run && !run.answered && /^[1-4]$/.test(event.key)) { const q = current(), choice = q?.choices[Number(event.key) - 1]; if (choice) { event.preventDefault(); answer(choice); } return; }
    if (run?.answered && event.key === 'Enter' && !event.target.closest?.('button')) { event.preventDefault(); next(); }
  }
  document.addEventListener('keydown', keydown);
  for (const [id, labelText] of TABS) el('tabs').append(h('button', { type: 'button', role: 'tab', class: 'trainer-tab', dataset: { trainerTab: id }, 'aria-selected': 'false', onClick: () => setTab(id) }, labelText));

  return {
    board,
    show(nextTab = 'plan') { lastFocus = document.activeElement; root.hidden = false; stats = readStats(storage); applyBoardLook(board); setTab(nextTab); el('heading').focus({ preventScroll: true }); },
    hide() { stopTimers(); run = null; lessonState = null; root.hidden = true; lastFocus = null; },
    startLesson,
    refreshLook() { applyBoardLook(board); board.render(display, {}); board.drawOverlay(); },
    get stats() { return stats; },
    stages: PLAN_STAGES,
  };
}
