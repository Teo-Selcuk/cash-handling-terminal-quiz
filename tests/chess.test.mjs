import test from 'node:test';
import assert from 'node:assert/strict';
import { ChessSession, normalizeSettings, gameEnding } from '../chess-core.mjs';
import { summarizeChess, classifyLoss, filterChessGames, chessChartSpecs, chessCsv } from '../chess-analytics.mjs';
import { CHESS_LESSONS } from '../chess-lessons.mjs';
import { Chess } from '../assets/chess/chess.mjs';
import { ChessStore } from '../chess-storage.mjs';
import { ChessEngine, compareEvaluations } from '../chess-engine.mjs';

test('settings reject out-of-range clocks and default to untimed Easy White', () => {
  assert.equal(normalizeSettings({}).difficulty, 'Easy');
  assert.equal(normalizeSettings({}).timeControl, 'untimed');
  assert.throws(() => normalizeSettings({ secondsPerMove: 0 }));
  assert.throws(() => normalizeSettings({ minutes: 61 }));
  assert.throws(() => normalizeSettings({ difficulty: 'toString' }));
});
test('illegal moves consume no turn; late moves are counted once and play continues', () => {
  const game = new ChessSession({ timeControl: 'move', secondsPerMove: 1 }, { now: 0, id: 'test' });
  assert.throws(() => game.move('e5', 500));
  game.tick(1200); game.tick(2000);
  assert.equal(game.lateCount.w, 1);
  game.move('e4', 2500);
  assert.equal(game.moves[0].elapsedMs, 2500);
  assert.equal(game.moves[0].late, true);
  assert.equal(game.result, null);
  assert.equal(game.clock(2500).elapsedMs, 0);
});
test('game clock uses actual elapsed time and increments only legal completed moves', () => {
  const game = new ChessSession({ timeControl: 'clock', minutes: 1, increment: 2 }, { now: 0 });
  game.move('e4', 1000);
  assert.equal(game.remaining.w, 61000);
  game.tick(62000);
  assert.equal(game.result.winner, 'w');
  assert.equal(game.result.reason, 'Time expired');
});
test('pause excludes downtime and restores move history as resumed practice', () => {
  const game = new ChessSession({ timeControl: 'move', secondsPerMove: 2 }, { now: 0 });
  game.move('e4', 500); game.pause(1000); game.resume(5000);
  game.move('e5', 5500);
  assert.equal(game.moves[1].elapsedMs, 1000);
  const restored = ChessSession.restore(game.snapshot(6000), 100000);
  assert.equal(restored.resumed, true);
  assert.equal(restored.chess.fen(), game.chess.fen());
  assert.equal(restored.moves.length, 2);
  assert.equal(restored.clock(100500).elapsedMs, 1000);
});
test('castling, en passant, promotion, mate, stalemate, draw and repetition work', () => {
  const castle = new ChessSession({}, { fen: 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', now: 0 });
  castle.move('O-O', 1); assert.equal(castle.chess.get('f1').type, 'r');
  const ep = new ChessSession({}, { now: 0 });
  for (const move of ['e4', 'a6', 'e5', 'd5', 'exd6']) ep.move(move, 1);
  assert.equal(ep.chess.get('d5'), undefined);
  const promotion = new ChessSession({}, { fen: '7k/P7/8/8/8/8/8/7K w - - 0 1', now: 0 });
  promotion.move({ from: 'a7', to: 'a8', promotion: 'n' }, 1);
  assert.equal(promotion.chess.get('a8').type, 'n');
  const mate = new ChessSession({}, { now: 0 });
  for (const move of ['f3', 'e5', 'g4', 'Qh4#']) mate.move(move, 1);
  assert.equal(mate.result.reason, 'Checkmate');
  assert.equal(gameEnding(new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')).reason, 'Stalemate');
  assert.equal(gameEnding(new Chess('7k/8/8/8/8/8/8/7K w - - 0 1')).winner, null);
  const repetition = new ChessSession({}, { now: 0 });
  for (const move of ['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1', 'Ng8']) repetition.move(move, 1);
  assert.equal(repetition.result.reason, 'Threefold repetition');
  assert.equal(gameEnding(new Chess('7k/8/8/8/8/8/8/R6K w - - 100 51')).reason, 'Fifty-move rule');
});
test('all 44 lessons contain legal guided exercises', () => {
  assert.equal(CHESS_LESSONS.length, 44);
  assert.equal(new Set(CHESS_LESSONS.map(l => l.id)).size, 44);
  for (const lesson of CHESS_LESSONS) {
    const board = new Chess(lesson.fen);
    assert.ok(lesson.steps.length > 0, lesson.title);
    for (const step of lesson.steps) assert.ok(board.move(step.move), `${lesson.title}: ${step.move}`);
  }
});
test('custom skill levels persist and legacy presets still resolve correctly', () => {
  assert.equal(normalizeSettings({ difficulty: 'Hard' }).skillLevel, 20);
  assert.equal(normalizeSettings({ difficulty: 'Medium', skillLevel: '7' }).skillLevel, 7);
  for (const skillLevel of [-1, 21, 1.5, 'invalid']) assert.throws(() => normalizeSettings({ skillLevel }));
  const game = new ChessSession({ difficulty: 'Easy', skillLevel: 8 }, { now: 0 });
  assert.equal(ChessSession.restore(game.snapshot(0)).settings.skillLevel, 8);
  assert.match(game.pgn(), /\[BotSkillLevel "8"\]/);
  const [header, row] = chessCsv([game.snapshot(0)]).split('\r\n');
  assert.ok(header.endsWith('"skillLevel"')); assert.ok(row.endsWith('"8"'));
  const legacy = game.snapshot(0); delete legacy.settings.skillLevel;
  assert.equal(ChessSession.restore(legacy).settings.skillLevel, 3);
  assert.ok(chessCsv([legacy]).split('\r\n')[1].endsWith('"3"'));
});
test('analytics keep unknown evaluations unknown and separate resumed/assisted games', () => {
  assert.equal(classifyLoss(50), 'Inaccuracy'); assert.equal(classifyLoss(100), 'Mistake');
  assert.equal(classifyLoss(200), 'Blunder'); assert.equal(classifyLoss(null), 'Unavailable');
  const game = new ChessSession({}, { now: 0 }); game.move('e4', 1000); game.finish('b', 'Resignation', 1000);
  const record = game.snapshot(1000);
  const summary = summarizeChess([record]);
  assert.equal(summary.losses, 1); assert.equal(summary.averageLoss, null);
  assert.equal(summary.averageMoveSeconds, 1);
  assert.equal(filterChessGames([{ ...record, resumed: true }], { practice: 'uninterrupted' }).length, 0);
});
test('saved games and lesson attempts update by id without duplicate records', () => {
  const data = new Map(); const storage = { getItem: k => data.get(k), setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) };
  const store = new ChessStore(storage);
  const game = new ChessSession({}, { now: 0, id: 'one' }).snapshot(0);
  store.saveGame(game); store.saveGame({ ...game, result: { winner: 'w', reason: 'Test' } });
  assert.equal(store.games().length, 1); assert.equal(store.games()[0].result.winner, 'w');
  const lesson = { id: 'try', lessonId: 'pawn', startedAt: new Date(0).toISOString(), retries: 0, hints: 0, moves: 0 };
  store.saveLesson(lesson); store.saveLesson({ ...lesson, completed: true });
  assert.equal(store.lessons().length, 1);
  store.saveCurrent(game); store.clearCurrent('other'); assert.ok(store.current());
  store.clearCurrent('one'); assert.equal(store.current(), null);
});
test('corrupt saved games fail explicitly without overwriting the original data', () => {
  const game = new ChessSession({}, { now: 0 }).snapshot(0);
  assert.throws(() => ChessSession.restore({ ...game, remaining: { w: -1, b: 10 } }));
  const text = JSON.stringify({ version: 1, value: [{ id: 'bad' }] });
  const store = new ChessStore({ getItem: () => text, setItem: () => assert.fail('must preserve corrupt data') });
  assert.throws(() => store.games(), /preserved/);
});
test('mate errors never become fictitious centipawn values', () => {
  assert.deepEqual(compareEvaluations({ score: { type: 'mate', value: 3 } }, { score: { type: 'cp', value: 200 } }), { loss: null, category: 'Forced mate error' });
  assert.equal(compareEvaluations({ score: { type: 'cp', value: 110 } }, { score: { type: 'cp', value: 60 } }).category, 'Inaccuracy');
});
test('canceled worker replies cannot resolve a request for a newer position', async () => {
  let worker;
  const engine = new ChessEngine({ workerFactory: () => (worker = {
    postMessage(command) {
      if (command === 'uci') queueMicrotask(() => this.onmessage({ data: 'uciok' }));
      if (command === 'isready') queueMicrotask(() => this.onmessage({ data: 'readyok' }));
      if (command.startsWith('go')) this.searching = true;
      if (command === 'stop') queueMicrotask(() => this.onmessage({ data: 'bestmove e2e4' }));
    }, terminate() {},
  }) });
  await engine.ready();
  const stale = engine.search('position startpos', 'old');
  await new Promise(resolve => setTimeout(resolve, 0)); engine.cancel();
  await assert.rejects(stale, { name: 'AbortError' });
  const current = engine.search('position startpos', 'new');
  await new Promise(resolve => setTimeout(resolve, 0));
  worker.onmessage({ data: 'info depth 5 score cp 30 pv d2d4 d7d5' });
  worker.onmessage({ data: 'bestmove d2d4' });
  assert.equal((await current).positionId, 'new'); engine.dispose();
});
test('late-move frequency uses only seconds-per-move opportunities', () => {
  const plain = new ChessSession({}, { now: 0 }); plain.move('e4', 100); plain.finish('w', 'Test', 100);
  const timed = new ChessSession({ timeControl: 'move', secondsPerMove: 1 }, { now: 0 }); timed.move('e4', 1100); timed.finish('w', 'Test', 1100);
  assert.equal(summarizeChess([plain.snapshot(100), timed.snapshot(1100)]).lateRate, 100);
});
test('a bare king cannot win on time against an opponent with a rook', () => {
  const game = new ChessSession({ timeControl: 'clock', minutes: 1 }, { fen: '7k/8/8/8/8/8/8/R6K w - - 0 1', now: 0 });
  game.tick(60000); assert.equal(game.result.winner, null); assert.match(game.result.reason, /no mating material/);
});
test('chart drill-down only references games that contributed to the outcome', () => {
  const win = new ChessSession({}, { now: 0, id: 'win' }); win.finish('w', 'Test', 0);
  const loss = new ChessSession({}, { now: 0, id: 'loss' }); loss.finish('b', 'Test', 0);
  const points = chessChartSpecs([win.snapshot(0), loss.snapshot(0)])[0].series[0].points;
  assert.deepEqual(points[0].attemptIds, ['win']); assert.deepEqual(points[1].attemptIds, []); assert.deepEqual(points[2].attemptIds, ['loss']);
});
