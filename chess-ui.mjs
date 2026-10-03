import { enhanceHistoryList } from './history-tables.mjs';
import { Chess, ChessSession, DEFAULT_POSITION, DIFFICULTIES, normalizeSettings } from './chess-core.mjs';
import { ChessBoard } from './chess-board.mjs';
import { ChessEngine, analyzeMove } from './chess-engine.mjs';
import { ChessStore, CHESS_KEYS } from './chess-storage.mjs';
import { CHESS_LESSONS } from './chess-lessons.mjs';
import { filterChessGames, summarizeChess, chessChartSpecs, chessCsv } from './chess-analytics.mjs';

const el = id => document.getElementById(`chess-${id}`);
const uciInput = move => ({ from: move.slice(0, 2), to: move.slice(2, 4), ...(move.length > 4 ? { promotion: move[4] } : {}) });
const fmt = value => value === null || value === undefined ? 'Not evaluated' : Number(value).toFixed(1);
const clockText = milliseconds => { const seconds = Math.max(0, Math.ceil(milliseconds / 1000)); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; };
const make = (tag, text, className = '') => { const node = document.createElement(tag); node.textContent = text; if (className) node.className = className; return node; };
const download = (text, name, type) => { const url = URL.createObjectURL(new Blob([text], { type })); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
const resultLabel = game => !game.result ? 'In progress' : game.result.winner === null ? 'Draw' : game.result.winner === game.player ? 'Win' : 'Loss';

export function createChessUI({ showScreen, renderChart, showChartData }) {
  const store = new ChessStore();
  let session = null, lesson = null, review = null, selected = null, hint = null, promotion = null;
  let busy = false, ready = false, engineError = false, active = false, savedAt = 0;
  let disabledSetup = new Map();
  const board = new ChessBoard(el('board'), selectSquare);
  const engine = new ChessEngine({ onError: handleEngineError });

  function status(message) { el('status').textContent = message; }
  function storageAction(action) {
    try { return action(); } catch (error) { const message = `Could not save or read chess progress: ${error.message} Export PGN to keep a copy.`; for (const id of ['storage-status', 'setup-storage-status']) { el(id).hidden = false; el(id).textContent = message; } el('history-status').textContent = error.message; return null; }
  }
  function settings() { return normalizeSettings({ difficulty: el('difficulty').value, skillLevel: el('level').value, color: el('color').value, timeControl: el('time-control').value, minutes: el('minutes').value, increment: el('increment').value, secondsPerMove: el('seconds').value, coaching: el('coaching').checked }); }
  function setSettings(value) {
    el('difficulty').value = value.difficulty; el('color').value = value.color; el('time-control').value = value.timeControl;
    el('minutes').value = value.minutes; el('increment').value = value.increment; el('seconds').value = value.secondsPerMove; el('coaching').checked = value.coaching;
    el('level').value = value.skillLevel; levelLabel();
    timeControls();
  }
  function timeControls() {
    const type = el('time-control').value;
    for (const id of ['minutes', 'increment']) { el(`${id}-label`).hidden = type !== 'clock'; el(id).disabled = type !== 'clock'; }
    el('seconds-label').hidden = type !== 'move'; el('seconds').disabled = type !== 'move';
    el('time-note').textContent = type === 'clock' ? 'The clock runs on each player’s turn. A flag ends the game; no mating material means a draw.' : type === 'move' ? 'A late move is counted once. You can still make it and continue the game.' : 'Untimed games continue until a result or resignation.';
  }
  function handleEngineError(error) {
    ready = false; busy = false; engineError = true;
    if (session && !session.result) { session.pause(); saveCurrent(); }
    el('setup-status').textContent = error.message; el('setup-retry').hidden = false; el('retry').hidden = false;
    status(`${error.message} Play and clocks are paused. Lessons remain available.`);
    render();
  }
  async function ensureEngine() {
    el('setup-status').textContent = 'Loading the local chess engine…';
    try {
      await engine.ready(); ready = true; engineError = false; el('setup-retry').hidden = true; el('retry').hidden = true;
      el('setup-status').textContent = 'Computer ready. All gameplay stays on this device.';
      return true;
    } catch (error) { if (error.name !== 'AbortError') handleEngineError(error); return false; }
  }
  function saveCurrent() { if (session && !session.result) storageAction(() => store.saveCurrent(session.snapshot())); }
  function saveFinished() {
    if (!session?.result) return;
    const record = session.snapshot();
    storageAction(() => { store.saveGame(record); store.clearCurrent(record.id); });
    document.getElementById('open-history').disabled = false;
  }
  function levelLabel() { el('level-value').textContent = `${el('level').value} / 20`; }
  function fitBoard() {
    const screen = el('screen');
    if (screen.hidden) return;
    if (window.innerWidth <= 760) { screen.style.removeProperty('--chess-board-size'); return; }
    // Re-measure after sizing the clocks, whose labels can wrap at narrow widths.
    for (let pass = 0; pass < 2; pass++) {
      const top = el('board').getBoundingClientRect().top - screen.getBoundingClientRect().top + screen.scrollTop;
      screen.style.setProperty('--chess-board-size', `${Math.max(128, Math.floor(screen.clientHeight - top - 24))}px`);
    }
  }
  function fullscreenLabel() {
    el('fullscreen').hidden = document.fullscreenElement === el('screen');
    el('fullscreen-note').textContent = document.fullscreenElement === el('screen') ? 'Fullscreen arena · Escape leaves browser fullscreen. Save & return pauses and saves your game.' : 'Focused arena · other app navigation is hidden. Enter fullscreen to hide browser controls.';
    fitBoard();
  }
  function requestFullscreen() {
    const screen = el('screen');
    if (document.fullscreenElement === screen) return;
    if (!screen.requestFullscreen) { el('fullscreen-note').textContent = 'Browser fullscreen is unavailable. The focused arena still fills this window.'; return; }
    screen.requestFullscreen({ navigationUI: 'hide' }).catch(() => {
      if (active) el('fullscreen-note').textContent = 'Browser fullscreen was unavailable. The focused arena still fills this window; you can retry with Enter fullscreen.';
    });
  }
  function open() { active = true; showScreen('chess'); fullscreenLabel(); requestFullscreen(); }
  async function start({ fen = DEFAULT_POSITION, lessonId = null, restored = null } = {}) {
    engine.cancel(); busy = false; lesson = null; review = null; selected = null; hint = null; promotion = null;
    session = restored ? ChessSession.restore(restored) : new ChessSession(settings(), { fen, lessonId });
    setSettings(session.settings); board.flipped = session.player === 'b';
    session.pause(Date.now(), false); open(); render();
    el('lessons').hidden = true; status('Loading the computer. Clocks start when it is ready.');
    const identity = session.id;
    if (!(await ensureEngine()) || !active || session?.id !== identity || lesson || review) return;
    session.resume(); saveCurrent(); render();
    if (session.result) { saveFinished(); return; }
    await computerTurn();
  }
  async function computerTurn() {
    if (!active || !session || session.result || session.paused || session.chess.turn() === session.player || lesson || review) { render(); return; }
    const game = session, positionId = game.positionId(); busy = true; render();
    status(`${game.settings.difficulty} computer is thinking…`);
    try {
      const budgetMs = game.settings.timeControl === 'clock' ? Math.max(50, Math.min(600, game.clock().remaining[game.chess.turn()] / 30)) : 400;
      const reply = await engine.search(game.positionCommand(), positionId, { skill: game.settings.skillLevel, budgetMs: Math.floor(budgetMs) });
      if (!active || session !== game || positionId !== game.positionId() || game.result || lesson || review) return;
      game.move(uciInput(reply.move)); selected = null; hint = null;
      if (game.result) saveFinished(); else saveCurrent();
    } catch (error) { if (game.result) saveFinished(); else if (error.name !== 'AbortError') handleEngineError(error); }
    finally { if (session === game) { busy = false; render(); } }
  }
  function displayChess() { return lesson?.chess ?? review?.chess ?? session?.chess ?? new Chess(); }
  function selectSquare(square) {
    if (!square) { selected = null; promotion = null; render(); return; }
    if (review || promotion || lesson?.phase === 'demo' || (!lesson && (!session || session.result || session.paused || busy || session.chess.turn() !== session.player))) return;
    const chess = displayChess(), piece = chess.get(square);
    if (selected) {
      const choices = chess.moves({ square: selected, verbose: true }).filter(move => move.to === square);
      if (choices.length) {
        if (choices.some(move => move.promotion)) {
          promotion = { from: selected, to: square }; el('promotion').hidden = false; el('promotion').querySelector('button').focus(); return;
        }
        void playMove({ from: selected, to: square }); return;
      }
    }
    selected = piece?.color === chess.turn() ? square : null; hint = null; render();
  }
  async function playMove(input) {
    if (lesson) { lessonMove(input); return; }
    const game = session;
    if (!game || busy || game.result || game.paused || game.chess.turn() !== game.player) return;
    game.tick(); if (game.result) { saveFinished(); render(); return; }
    const positionCommand = game.positionCommand(), positionId = game.positionId();
    try { game.move(input); } catch (error) { status(error.message); render(); return; }
    selected = null; hint = null; promotion = null; el('feedback').textContent = '';
    if (game.result) saveFinished(); else saveCurrent(); render();
    // Start the opponent promptly; feedback uses the same serialized worker after its move.
    const computer = computerTurn();
    if (game.settings.coaching) {
      game.feedbackUsed++; const moveIndex = game.moves.length - 1, move = game.moves[moveIndex];
      try {
        const feedback = await analyzeMove(engine, positionCommand, positionId, move.uci, move.color);
        if (session === game && active && !lesson && !review) el('feedback').textContent = `${move.san}: ${feedback.category}${feedback.loss === null ? '' : `, ${feedback.loss} centipawns lost`}. Alternative: ${sanLine(move.before, feedback.pv)}.`;
        if (session === game) { if (game.result) saveFinished(); else saveCurrent(); }
      } catch (error) { if (error.name !== 'AbortError') handleEngineError(error); }
    }
    await computer;
  }
  function render() {
    const chess = displayChess();
    const targets = selected ? chess.moves({ square: selected, verbose: true }).map(move => move.to) : [];
    const last = chess.history({ verbose: true }).at(-1);
    board.render(chess, { selected, targets, lastMove: last, hint });
    requestAnimationFrame(fitBoard);
    el('promotion').hidden = !promotion;
    el('lesson-detail').hidden = !lesson; el('game-actions').hidden = Boolean(lesson);
    el('review').hidden = !review;
    el('clocks').hidden = Boolean(lesson || review || !session);
    el('hint').hidden = !session?.settings.coaching || Boolean(review); el('hint').disabled = busy || !session || session.paused || Boolean(session.result) || session.chess.turn() !== session.player;
    el('resign').hidden = !session || Boolean(session.result || review);
    el('rematch').hidden = !session?.result || Boolean(review);
    el('analyze').hidden = !(review || session?.result); el('analyze').disabled = busy;
    el('pgn').hidden = !session && !review;
    el('progress').hidden = Boolean(session && !session.result && !review && !lesson);
    const moves = chess.history();
    el('moves').replaceChildren(...moves.map((san, i) => make('li', `${Math.floor(i / 2) + 1}${i % 2 ? '…' : '.'} ${san}`)));
    if (session && !lesson && !review) {
      const color = session.player === 'w' ? 'White' : 'Black';
      el('game-label').textContent = `${color} vs ${session.settings.difficulty} · level ${session.settings.skillLevel}/20`;
      el('game-details').textContent = `${session.settings.timeControl === 'clock' ? `${session.settings.minutes}+${session.settings.increment} game clock` : session.settings.timeControl === 'move' ? `${session.settings.secondsPerMove}s per move` : 'Untimed'}${session.resumed ? ' · resumed practice' : session.interrupted ? ' · interrupted practice' : ''}${session.lessonId ? ' · lesson position' : ''}${session.settings.coaching || session.hints ? ' · assisted' : ''}`;
      if (session.result) status(`${resultLabel(session)} — ${session.result.reason}. Use Analyze game to review alternatives.`);
      else if (session.paused) status(engineError ? 'Engine unavailable. Play and clocks are paused; retry to continue.' : 'Game paused.');
      else if (!busy) status(`${chess.turn() === session.player ? 'Your' : 'Computer’s'} turn (${chess.turn() === 'w' ? 'White' : 'Black'})${chess.isCheck() ? ' — check' : ''}.`);
      updateClocks();
    }
  }
  function updateClocks() {
    if (!session || lesson || review) return;
    const clock = session.clock(), turn = session.chess.turn();
    for (const color of ['w', 'b']) {
      const name = color === session.player ? 'You' : 'Computer';
      let text = session.settings.timeControl === 'clock' ? clockText(clock.remaining[color]) : session.settings.timeControl === 'move' && color === turn ? `${clockText(Math.max(0, session.settings.secondsPerMove * 1000 - clock.elapsedMs))} · ${Math.floor(clock.elapsedMs / 1000)}s elapsed${session.turnLate ? ' · LATE' : ''}` : 'Untimed';
      if (session.settings.timeControl === 'move' && color !== turn) text = `${session.settings.secondsPerMove}s / move`;
      el(`clock-${color}`).textContent = `${name} · ${color === 'w' ? 'White' : 'Black'} · ${text}${session.settings.timeControl === 'move' ? ` · ${session.lateCount[color]} late` : ''}`;
      el(`clock-${color}`).classList.toggle('active-clock', turn === color && !session.result);
      el(`clock-${color}`).classList.toggle('low-clock', session.settings.timeControl === 'clock' && clock.remaining[color] < 20000 && !session.result);
    }
  }
  function tick() {
    if (!active || !session || session.result || session.paused || lesson || review) return;
    session.tick();
    if (session.result) { engine.cancel(); busy = false; saveFinished(); render(); }
    else updateClocks();
    if (Date.now() - savedAt > 1000) { saveCurrent(); savedAt = Date.now(); }
  }
  setInterval(tick, 200);
  window.addEventListener('pagehide', () => { tick(); saveCurrent(); });
  document.addEventListener('visibilitychange', tick);

  function saveLesson() { if (lesson) storageAction(() => store.saveLesson(lesson.attempt)); }
  function listLessons() {
    el('lesson-list').replaceChildren();
    const attempts = storageAction(() => store.lessons()) ?? [];
    for (const category of ['Pieces & rules', 'Openings', 'Tactics & endgames']) {
      const section = make('section', ''), title = make('h4', category), choices = make('div', '', 'chess-lesson-buttons'); section.append(title, choices);
      for (const item of CHESS_LESSONS.filter(l => l.category === category)) {
        const complete = attempts.some(a => a.lessonId === item.id && a.completed);
        const button = make('button', `${complete ? '✓ ' : ''}${item.title}`, 'secondary-button'); button.type = 'button'; button.dataset.lesson = item.id;
        button.addEventListener('click', () => startLesson(item)); choices.append(button);
      }
      el('lesson-list').append(section);
    }
  }
  function startLesson(item) {
    if (session && !session.result) { session.pause(); saveCurrent(); }
    engine.cancel(); busy = false; selected = null; promotion = null; hint = null; review = null;
    lesson = { item, phase: 'demo', chess: new Chess(item.fen), index: 0, attempt: { id: crypto.randomUUID(), lessonId: item.id, startedAt: new Date().toISOString(), completed: false, retries: 0, hints: 0, moves: 0 } };
    board.flipped = lesson.chess.turn() === 'b'; open(); document.getElementById('open-history').disabled = false;
    el('lessons').hidden = true; el('lesson-title').textContent = item.title; el('lesson-text').textContent = item.text;
    el('lesson-source').href = item.source; el('lesson-feedback').textContent = ''; lessonStep(); saveLesson(); render();
    status('Watch the demonstration first. Show next move explains and highlights each move.');
    el('demo-next').focus();
  }
  function lessonStep() {
    const demo = lesson.phase === 'demo';
    el('demo-next').hidden = !demo; el('demo-next').disabled = lesson.index === lesson.item.steps.length;
    el('practice').hidden = !demo; el('practice').disabled = lesson.index !== lesson.item.steps.length;
    el('lesson-play').disabled = demo; el('lesson-hint').hidden = demo;
    if (demo) {
      el('lesson-step').textContent = lesson.index === lesson.item.steps.length ? 'Demonstration complete. Practice it yourself resets the board so you can repeat every move.' : `Demonstration · ${lesson.index}/${lesson.item.steps.length} moves shown. Select Show next move to watch the next move.`;
      return;
    }
    el('lesson-step').textContent = lesson.index === lesson.item.steps.length ? 'Exercise complete. Try the position against the computer or choose another lesson.' : `Step ${lesson.index + 1}/${lesson.item.steps.length} · ${lesson.chess.turn() === 'w' ? 'White' : 'Black'}: ${lesson.item.steps[lesson.index].text}`;
    el('lesson-hint').disabled = lesson.attempt.completed;
  }
  function lessonMove(input) {
    if (lesson.phase !== 'practice' || lesson.attempt.completed) return;
    const expected = lesson.item.steps[lesson.index].move;
    let move;
    try { move = lesson.chess.move(input); } catch { return; }
    lesson.attempt.moves++;
    if (move.san !== expected) {
      lesson.chess.undo(); lesson.attempt.retries++;
      el('lesson-feedback').textContent = 'That is legal, but this exercise is practicing a different idea. Read the instruction and try again.';
    } else {
      lesson.index++; el('lesson-feedback').textContent = 'Correct. ' + lesson.item.steps[lesson.index - 1].text;
      if (lesson.index === lesson.item.steps.length) { lesson.attempt.completed = true; lesson.attempt.completedAt = new Date().toISOString(); }
    }
    selected = null; hint = null; promotion = null; lessonStep(); saveLesson(); render();
  }
  function sanLine(fen, moves) {
    const chess = new Chess(fen), line = [];
    for (const move of moves ?? []) { try { line.push(chess.move(uciInput(move)).san); } catch { break; } }
    return line.join(' ') || 'No continuation available';
  }
  function reviewGame(record) {
    if (session && !session.result) { session.pause(); saveCurrent(); }
    engine.cancel(); busy = false; lesson = null; selected = null; promotion = null; hint = null;
    review = { record, chess: new Chess(record.startFen), index: 0 }; board.flipped = record.player === 'b';
    open(); document.getElementById('open-history').disabled = false; el('lessons').hidden = true;
    el('replay').max = record.moves.length; el('replay').value = 0;
    el('game-label').textContent = `${resultLabel(record)} vs ${record.settings.difficulty} · level ${normalizeSettings(record.settings).skillLevel}/20`; el('game-details').textContent = `${record.result.reason} · ${new Date(record.startedAt).toLocaleString()}`;
    status('Game review. Use the slider or Previous / Next to replay.'); renderReview(); render();
  }
  function renderReview() {
    if (!review) return;
    const { record, index } = review;
    review.chess = new Chess(record.startFen);
    for (const move of record.moves.slice(0, index)) review.chess.move(move.san);
    const row = record.analysis?.rows?.[index - 1], move = record.moves[index - 1];
    el('review-status').textContent = record.analysis?.status === 'complete' ? `Review complete · ${record.analysis.rows.length} moves evaluated · ${record.analysis.engine}` : record.analysis?.status === 'running' ? `Analyzing ${record.analysis.rows.length}/${record.moves.length} moves…` : `Analysis ${record.analysis?.status ?? 'pending'}. Use Analyze game to evaluate moves.`;
    el('review-move').textContent = move ? `Move ${Math.floor((index - 1) / 2) + 1}${move.color === 'w' ? '.' : '…'} ${move.san} · ${(move.elapsedMs / 1000).toFixed(1)}s${move.late ? ' · late' : ''}` : 'Starting position';
    const score = row?.playedScore;
    const evalText = score ? score.type === 'cp' ? `Evaluation for ${row.color === 'w' ? 'White' : 'Black'}: ${(score.value / 100).toFixed(2)} pawns` : `Forced mate in ${Math.abs(score.value)}${score.value < 0 ? ' against the mover' : ' for the mover'}` : 'Not evaluated';
    el('review-eval').textContent = row ? `${row.category}${row.loss === null ? '' : ` · ${row.loss} centipawns lost`}. ${evalText}. Best line: ${sanLine(move.before, row.pv)}.` : 'No evaluation for this position yet.';
    el('review-prev').disabled = index === 0; el('review-next').disabled = index === record.moves.length;
    el('analyze').textContent = record.analysis?.status === 'unavailable' ? 'Retry analysis' : record.analysis?.status === 'complete' ? 'Reanalyze game' : 'Analyze game';
  }
  async function analyzeGame() {
    const record = review?.record ?? session?.snapshot();
    if (!record?.result || busy) return;
    if (!review || review.record.id !== record.id) reviewGame(record);
    const view = review;
    if (!(await ensureEngine()) || review !== view || !active) return;
    busy = true; record.analysis = { ...record.analysis, status: 'running', rows: [] }; render();
    const replay = new Chess(record.startFen);
    try {
      for (let i = 0; i < record.moves.length; i++) {
        const move = record.moves[i], position = `position fen ${record.startFen}${i ? ` moves ${record.moves.slice(0, i).map(m => m.uci).join(' ')}` : ''}`;
        const row = await analyzeMove(engine, position, `${record.id}:review:${i}`, move.uci, replay.turn());
        if (review !== view || !active) return;
        record.analysis.rows.push(row); replay.move(move.san);
        storageAction(() => store.saveGame(record)); renderReview();
      }
      record.analysis.status = 'complete';
    } catch (error) {
      record.analysis.status = error.name === 'AbortError' ? 'pending' : 'unavailable';
      if (error.name !== 'AbortError') status('Analysis is unavailable. Retry to finish reviewing this game.');
    } finally {
      if (record.analysis.status === 'running') record.analysis.status = 'pending';
      storageAction(() => store.saveGame(record));
      if (session?.id === record.id) session.analysis = record.analysis;
      if (review === view) { busy = false; renderReview(); render(); }
    }
  }
  function historyFilters() { return { difficulty: el('filter-difficulty').value, timeControl: el('filter-time').value, practice: el('filter-practice').value, startDate: el('filter-from').value, endDate: el('filter-to').value }; }
  let sampleHistory = null;
  function renderHistory(data = sampleHistory) {
    sampleHistory = data;
    el('history-status').textContent = '';
    const games = filterChessGames(data?.games ?? storageAction(() => store.games()) ?? [], historyFilters());
    const attempts = data?.lessons ?? storageAction(() => store.lessons()) ?? [], summary = summarizeChess(games, attempts);
    el('history-metrics').replaceChildren(...[
      ['Games', summary.games], ['Wins / draws / losses', `${summary.wins} / ${summary.draws} / ${summary.losses}`], ['Win rate', summary.winRate === null ? 'No games' : `${fmt(summary.winRate)}%`],
      ['Your average move', summary.averageMoveSeconds === null ? 'No moves' : `${fmt(summary.averageMoveSeconds)}s`], ['Your late moves', summary.lateMoves], ['Late-move frequency', summary.lateRate === null ? 'No moves' : `${fmt(summary.lateRate)}%`],
      ['Average centipawn loss', fmt(summary.averageLoss)], ['Evaluated moves', summary.evaluatedMoves], ['Mistakes / blunders / mate errors', summary.mistakes], ['Lessons completed', `${summary.completedLessons} / 24`], ['Lesson attempts', summary.lessonAttempts],
    ].map(([label, value]) => { const card = make('div', '', 'metric'); card.append(make('strong', String(value)), make('span', label)); return card; }));
    el('history-charts').replaceChildren(...chessChartSpecs(games, attempts).map(spec => renderChart({ ...spec, description: data ? 'Fictional sample games with synthetic move evaluations.' : spec.description, onPoint: ids => {
      const record = games.find(g => ids.includes(g.id)); if (record && !data) reviewGame(record); else showChartData(spec);
    } }, games)));
    el('history-games').replaceChildren();
    if (!games.length) el('history-games').append(make('p', 'No chess games match these filters. Finish a game to see results here.'));
    for (const game of [...games].reverse()) {
      const card = make('article', '', 'visual-card');
      card.append(make('h4', `${resultLabel(game)} vs ${game.settings.difficulty} · level ${normalizeSettings(game.settings).skillLevel}/20`), make('p', `${new Date(game.startedAt).toLocaleString()} · ${game.result.reason} · ${game.settings.timeControl} · ${game.moves.length} moves${game.resumed || game.interrupted ? ' · resumed / interrupted' : ''}${game.settings.coaching || game.hints || game.feedbackUsed ? ' · assisted' : ''}${game.lessonId ? ' · lesson position' : ''} · Analysis: ${game.analysis?.status ?? 'pending'}`));
      if (!data) { const button = make('button', 'Replay & review', 'secondary-button'); button.type = 'button'; button.addEventListener('click', () => reviewGame(game)); card.append(button); }
      el('history-games').append(card);
    }
    el('history-lessons').replaceChildren();
    const list = make('ul', '');
    for (const attempt of attempts) list.append(make('li', `${CHESS_LESSONS.find(l => l.id === attempt.lessonId)?.title ?? attempt.lessonId} · ${attempt.completed ? 'Completed' : 'In progress'} · ${attempt.retries} retries · ${attempt.hints} hints · ${new Date(attempt.startedAt).toLocaleString()}`));
    el('history-lessons').append(attempts.length ? list : make('p', 'No lesson attempts yet.'));
    enhanceHistoryList(el('history-games'), 'chess-games', 'Chess game history');
    enhanceHistoryList(el('history-lessons'), 'chess-lessons', 'Lesson attempts and hints');
    if (!el('history-status').textContent) el('history-status').textContent = data ? `Based on Sample Data · ${games.length} fictional games and lesson attempts. Move evaluations are synthetic demonstrations.` : `${games.length} saved games. Evaluations pending or unavailable are excluded from centipawn averages.`;
  }
  function leave() {
    if (session && !session.result) { session.pause(); saveCurrent(); }
    engine.cancel(); active = false; busy = false;
    showScreen('setup'); setupChanged('chess');
  }
  function setupChanged(game) {
    const chess = game === 'chess', form = document.getElementById('setup-form');
    form.classList.toggle('chess-setup-selected', chess); el('setup-options').hidden = !chess;
    form.querySelector('button[type="submit"]').textContent = chess ? 'Start chess game' : 'Start quiz';
    const controls = [...form.querySelectorAll('input, select, button')].filter(node => !node.closest('#chess-setup-options') && node.name !== 'game' && node.type !== 'submit');
    if (chess && !disabledSetup.size) { for (const node of controls) { disabledSetup.set(node, node.disabled); node.disabled = true; } }
    if (!chess && disabledSetup.size) { for (const [node, disabled] of disabledSetup) node.disabled = disabled; disabledSetup = new Map(); }
    for (const node of el('setup-options').querySelectorAll('input,select,button')) node.disabled = !chess;
    if (chess) {
      timeControls(); el('resume').hidden = !storageAction(() => store.current());
      if (!ready && !engineError) void ensureEngine();
    }
  }
  el('time-control').addEventListener('change', timeControls);
  el('difficulty').addEventListener('change', () => { el('level').value = DIFFICULTIES[el('difficulty').value]; levelLabel(); });
  el('level').addEventListener('input', levelLabel);
  el('fullscreen').addEventListener('click', requestFullscreen);
  document.addEventListener('fullscreenchange', fullscreenLabel);
  window.addEventListener('resize', fitBoard);
  el('clock-presets').addEventListener('click', event => { const button = event.target.closest('button[data-chess-minutes]'); const value = button?.dataset.chessMinutes; if (value) { el('time-control').value = 'clock'; el('minutes').value = value; el('increment').value = button.dataset.chessIncrement ?? 0; timeControls(); } });
  el('back').addEventListener('click', leave);
  el('progress').addEventListener('click', () => document.getElementById('open-history').click());
  el('setup-retry').addEventListener('click', ensureEngine);
  el('retry').addEventListener('click', async () => { const game = session; if (await ensureEngine()) { if (session === game && game && !lesson && !review && active) { game.resume(); render(); await computerTurn(); } else if (review) { busy = false; status('Engine ready. Retry analysis to finish this review.'); render(); } } });
  el('resume').addEventListener('click', () => { const record = storageAction(() => store.current()); if (record) void start({ restored: record }).catch(error => status(error.message)); });
  el('flip').addEventListener('click', () => { board.flipped = !board.flipped; render(); });
  el('resign').addEventListener('click', () => { if (!session || session.result || review || lesson) return; session.finish(session.player === 'w' ? 'b' : 'w', 'Resignation'); engine.cancel(); busy = false; saveFinished(); render(); });
  el('rematch').addEventListener('click', () => { if (session) { setSettings(session.settings); void start({ fen: session.startFen, lessonId: session.lessonId }); } });
  el('analyze').addEventListener('click', analyzeGame);
  el('pgn').addEventListener('click', () => { const game = review ? ChessSession.restore(review.record) : session; if (game) download(game.pgn(), `chess-${game.id}.pgn`, 'application/x-chess-pgn'); });
  el('hint').addEventListener('click', async () => {
    const game = session; if (!game || busy || game.result || game.paused || game.chess.turn() !== game.player) return;
    const id = game.positionId(); busy = true; game.hints++; saveCurrent(); render();
    try {
      const reply = await engine.search(game.positionCommand(), id);
      if (session === game && game.positionId() === id && active && !lesson && !review && !game.result) { hint = reply.move; el('feedback').textContent = `Hint: ${sanLine(game.chess.fen(), reply.pv)}. Highlighted squares show the suggested move.`; }
    } catch (error) { if (error.name !== 'AbortError') handleEngineError(error); }
    finally { if (session === game) { busy = false; render(); } }
  });
  el('promotion').addEventListener('click', event => { const piece = event.target.dataset.promotion; if (piece && promotion) { const move = { ...promotion, promotion: piece }; promotion = null; void playMove(move); board.buttons.get(move.to)?.focus(); } });
  el('cancel-promotion').addEventListener('click', () => { promotion = null; selected = null; render(); board.buttons.get(board.focusSquare)?.focus(); });
  el('replay').addEventListener('input', () => { if (review) { review.index = Number(el('replay').value); renderReview(); render(); } });
  for (const [id, delta] of [['review-prev', -1], ['review-next', 1]]) el(id).addEventListener('click', () => { if (review) { review.index = Math.max(0, Math.min(review.record.moves.length, review.index + delta)); el('replay').value = review.index; renderReview(); render(); } });
  el('lessons-toggle').addEventListener('click', () => { el('lessons').hidden = !el('lessons').hidden; listLessons(); });
  el('open-lessons').addEventListener('click', () => { if (session && !session.result) { session.pause(); saveCurrent(); } engine.cancel(); busy = false; lesson = null; review = null; open(); document.getElementById('open-history').disabled = false; listLessons(); el('lessons').hidden = false; render(); status('Choose a lesson to learn a piece, opening, or tactical idea.'); });
  el('demo-next').addEventListener('click', () => {
    if (!lesson || lesson.phase !== 'demo' || lesson.index >= lesson.item.steps.length) return;
    const step = lesson.item.steps[lesson.index], move = lesson.chess.move(step.move);
    lesson.index++; hint = move.from + move.to;
    el('lesson-feedback').textContent = `${lesson.index}/${lesson.item.steps.length} · ${move.color === 'w' ? 'White' : 'Black'} plays ${move.san}: ${move.from} → ${move.to}${move.promotion ? ' (promote to ' + move.promotion + ')' : ''}. ${step.text}`;
    lessonStep(); render();
    if (lesson.index === lesson.item.steps.length) el('practice').focus();
  });
  el('practice').addEventListener('click', () => {
    if (!lesson || lesson.phase !== 'demo' || lesson.index !== lesson.item.steps.length) return;
    lesson.phase = 'practice'; lesson.chess = new Chess(lesson.item.fen); lesson.index = 0;
    selected = null; hint = null; promotion = null; el('lesson-feedback').textContent = 'Your turn to practice. Repeat the demonstrated moves; you can use a hint when needed.';
    lessonStep(); render(); status('Practice — play both sides and follow the instruction for each move.');
    board.buttons.get(board.order.find(square => lesson.chess.get(square)?.color === lesson.chess.turn()))?.focus();
  });
  el('lesson-hint').addEventListener('click', () => { if (lesson && !lesson.attempt.completed) { lesson.attempt.hints++; const chess = new Chess(lesson.chess.fen()); const move = chess.move(lesson.item.steps[lesson.index].move); hint = move.from + move.to; el('lesson-feedback').textContent = `Play ${move.san}: ${move.from} to ${move.to}${move.promotion ? ', promote to ' + move.promotion : ''}.`; saveLesson(); render(); } });
  el('lesson-restart').addEventListener('click', () => { if (lesson) startLesson(lesson.item); });
  el('lesson-play').addEventListener('click', () => { if (lesson) { const fen = lesson.chess.isGameOver() ? lesson.item.fen : lesson.chess.fen(), lessonId = lesson.item.id; el('color').value = new Chess(fen).turn(); void start({ fen, lessonId }); } });
  for (const id of ['filter-difficulty', 'filter-time', 'filter-practice', 'filter-from', 'filter-to']) el(id).addEventListener('change', () => renderHistory());
  el('download-csv').addEventListener('click', () => download(chessCsv(filterChessGames(sampleHistory?.games ?? storageAction(() => store.games()) ?? [], historyFilters())), sampleHistory ? 'sample-chess-analytics.csv' : 'chess-analytics.csv', 'text/csv;charset=utf-8'));
  window.addEventListener('storage', event => { if (Object.values(CHESS_KEYS).includes(event.key) && !el('history').hidden) renderHistory(); });
  timeControls(); render();
  return { start, setupChanged, renderHistory, leave, onHistoryOpen() { active = false; engine.cancel(); busy = false; } };
}
