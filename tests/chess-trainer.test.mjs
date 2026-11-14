import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from '../chess-core.mjs';
import { CHESS_LESSONS } from '../chess-lessons.mjs';
import {
  TRAINER_CONCEPTS, TRACKS, ALL_QUESTIONS, DRILL_QUESTIONS, scoreMove, refutation, mirrorFen, mirrorSan, mirrorText,
  rng, flashDeck, analysisDeck, readAheadQuestion, lessonQuiz, emptyStats, recordAnswer, recordLesson, recordRun,
  mistakeQueue, planProgress, dailyWorkout, modeSummary, nameThatIdea, PLAN_STAGES,
} from '../chess-trainer.mjs';

const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const material = (chess, color) => chess.board().flat().filter(Boolean).reduce((s, p) => s + (p.color === color ? 1 : -1) * VALUE[p.type], 0);
const legal = (fen, san) => { try { new Chess(fen).move(san); return true; } catch { return false; } };
const after = (fen, san) => { const chess = new Chess(fen); chess.move(san); return chess; };
const checkers = chess => chess.attackers(chess.board().flat().find(p => p && p.type === 'k' && p.color === chess.turn()).square, chess.turn() === 'w' ? 'b' : 'w').length;
const pawnsOn = (chess, file) => chess.board().flat().filter(p => p && p.type === 'p' && p.square[0] === file);

function isOutpost(chess, square, color) {
  const [file, rank] = [square.charCodeAt(0) - 97, Number(square[1])];
  if (color === 'w' ? rank < 5 : rank > 4) return false;
  const pawns = chess.board().flat().filter(p => p && p.type === 'p');
  const guarded = pawns.some(p => p.color === color && Math.abs(p.square.charCodeAt(0) - 97 - file) === 1 && Number(p.square[1]) === rank + (color === 'w' ? -1 : 1));
  const attackable = pawns.some(p => p.color !== color && Math.abs(p.square.charCodeAt(0) - 97 - file) === 1 && (color === 'w' ? Number(p.square[1]) > rank : Number(p.square[1]) < rank));
  return guarded && !attackable;
}

function verify(q) {
  const where = `${q.id}${q.mirrored ? ' (mirrored)' : ''}`;
  if (q.fen) assert.doesNotThrow(() => new Chess(q.fen), where);
  assert.ok(q.choices.includes(q.answer), `${where}: answer is a choice`);
  assert.equal(new Set(q.choices).size, q.choices.length, `${where}: unique choices`);
  assert.ok(q.why?.length > 20, `${where}: explanation`);
  const check = q.check ?? (q.kind === 'move' ? { type: 'best' } : null);
  if (q.kind === 'move') for (const san of q.choices) assert.ok(legal(q.fen, san), `${where}: ${san} is legal SAN`);
  if (!check) return;
  const mover = q.fen && new Chess(q.fen).turn();
  switch (check.type) {
    case 'best': {
      const depth = check.depth ?? 2;
      const scores = Object.fromEntries(q.choices.map(san => [san, scoreMove(q.fen, san, depth)]));
      for (const san of q.choices) if (san !== q.answer) assert.ok(scores[q.answer] > scores[san], `${where}: ${q.answer} (${scores[q.answer]}) beats ${san} (${scores[san]})`);
      assert.ok(scores[q.answer] > material(new Chess(q.fen), mover) || scores[q.answer] > 500 || depth === 1, `${where}: answer gains`);
      break;
    }
    case 'mate':
      assert.ok(after(q.fen, q.answer).isCheckmate(), `${where}: ${q.answer} mates`);
      for (const san of q.choices) if (san !== q.answer) assert.ok(!after(q.fen, san).isCheckmate(), `${where}: ${san} is not mate`);
      break;
    case 'bad': assert.ok(scoreMove(q.fen, check.move, 3) < material(new Chess(q.fen), mover) - 0.5, `${where}: ${check.move} loses material`); break;
    case 'illegal': assert.ok(!legal(q.fen, check.move), `${where}: ${check.move} is illegal`); break;
    case 'relative': { const chess = after(q.fen, check.move); const punish = chess.move(check.punish); assert.equal(punish.captured, 'q', where); break; }
    case 'compare': assert.ok(scoreMove(q.fen, check.better, 3) > scoreMove(q.fen, check.worse, 3), `${where}: ${check.better} beats ${check.worse}`); break;
    case 'double':
      assert.equal(checkers(after(q.fen, q.answer)), 2, `${where}: ${q.answer} is double check`);
      for (const san of q.choices) if (san !== q.answer) assert.ok(checkers(after(q.fen, san)) < 2, `${where}: ${san} single`);
      break;
    case 'notmate': { const chess = after(q.fen, check.move); assert.ok(chess.isCheck() && !chess.isCheckmate(), where); break; }
    case 'stalemate': assert.ok(after(q.fen, check.move).isStalemate(), where); break;
    case 'check':
      assert.ok(after(q.fen, q.answer).isCheck(), `${where}: answer checks`);
      for (const san of q.choices) if (san !== q.answer) assert.ok(!after(q.fen, san).isCheck(), `${where}: ${san} no check`);
      break;
    case 'outpost': {
      const chess = new Chess(q.fen);
      assert.ok(isOutpost(chess, q.answer, check.color), `${where}: ${q.answer} is an outpost`);
      for (const sq of q.choices) if (sq !== q.answer) assert.ok(!isOutpost(chess, sq, check.color), `${where}: ${sq} is not`);
      break;
    }
    case 'openfile': {
      const chess = new Chess(q.fen);
      assert.ok(legal(q.fen, q.answer), where);
      assert.equal(pawnsOn(chess, after(q.fen, q.answer).history({ verbose: true })[0].to[0]).length, 0, `${where}: open file`);
      for (const san of q.choices) if (san !== q.answer) assert.ok(pawnsOn(chess, after(q.fen, san).history({ verbose: true })[0].to[0]).length > 0, `${where}: ${san} file has pawns`);
      break;
    }
    case 'none': break;
    default: assert.fail(`${where}: unknown check ${check.type}`);
  }
}

test('every lesson has simple text, a legal animated demo and a quiz', () => {
  assert.ok(TRAINER_CONCEPTS.length >= 20);
  for (const track of TRACKS) assert.ok(TRAINER_CONCEPTS.some(c => c.track === track), track);
  assert.equal(new Set(TRAINER_CONCEPTS.map(c => c.id)).size, TRAINER_CONCEPTS.length);
  for (const c of TRAINER_CONCEPTS) {
    assert.ok(c.summary.length > 40 && c.when.length && c.whenNot.length, c.id);
    const chess = new Chess(c.demo.fen);
    for (const step of c.demo.steps) { assert.doesNotThrow(() => chess.move(step.san), `${c.id} demo ${step.san}`); assert.ok(step.note.length > 10); }
    assert.ok(c.quiz.length >= 1, c.id);
  }
  assert.equal(new Set(DRILL_QUESTIONS.map(q => q.id)).size, DRILL_QUESTIONS.length, 'question ids unique');
});

test('every quiz answer is right and every wrong choice is really wrong', () => {
  for (const q of ALL_QUESTIONS) verify(q);
});

test('mirrored drill positions keep their answers', () => {
  const mirrored = DRILL_QUESTIONS.filter(q => q.mirrored);
  assert.ok(mirrored.length >= 15, `${mirrored.length} mirrored`);
  for (const q of mirrored) verify(q);
  assert.equal(mirrorFen('4k3/8/8/8/8/8/8/R3K3 w - - 0 1'), '3k4/8/8/8/8/8/8/3K3R w - - 0 1');
  assert.equal(mirrorSan('Nxc7+'), 'Nxf7+');
  assert.equal(mirrorText('Bxd5 exd5, then the h-file and c- or e-pawn'), 'Bxe5 dxe5, then the a-file and f- or d-pawn');
});

test('a wrong move is explained by the opponent’s best reply', () => {
  const fork = ALL_QUESTIONS.find(q => q.id === 'fork-2');
  assert.match(refutation(fork.fen, 'Nd6+').text, /exd6 captures your knight/);
  const threat = ALL_QUESTIONS.find(q => q.id === 'threats-1');
  assert.match(refutation(threat.fen, 'Nf6').text, /Qxf7# is checkmate/);
});

test('flash, analysis and read-ahead decks are valid and repeatable', () => {
  for (const level of ['Easy', 'Medium', 'Hard']) {
    const deck = flashDeck({ level, random: rng(7) });
    assert.ok(deck.questions.length >= 10 && deck.seconds > 0, level);
    assert.deepEqual(deck.questions.map(q => q.id), flashDeck({ level, random: rng(7) }).questions.map(q => q.id));
    for (const q of deck.questions) assert.ok(q.choices.includes(q.answer));
  }
  const analysis = analysisDeck({ count: 10, random: rng(3) });
  assert.equal(analysis.length, 10);
  assert.ok(analysis.every(q => q.kind === 'move'));
  const openings = CHESS_LESSONS.filter(l => l.category === 'Openings');
  for (let seed = 1; seed <= 150; seed++) for (const depth of [2, 3, 4]) {
    const q = readAheadQuestion({ depth, openings, random: rng(seed * 10 + depth) });
    assert.ok(q, `seed ${seed}`);
    assert.equal(q.line.length, depth);
    assert.ok(q.choices.includes(q.answer) && new Set(q.choices).size === 4, q.id);
    const chess = new Chess(q.fen); for (const san of q.line) chess.move(san);
    assert.equal(chess.fen(), q.finalFen);
    if (q.playable) assert.ok(legal(q.finalFen, q.answer));
    else if (q.ask.startsWith('Follow')) { const piece = chess.get(q.answer); assert.ok(piece, q.id); }
    else { const square = q.ask.match(/on ([a-h][1-8])\?/)[1]; const piece = chess.get(square); assert.equal(q.answer, piece ? `${piece.color === 'w' ? 'White' : 'Black'} ${({ p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' })[piece.type]}` : 'Empty'); }
  }
  const named = nameThatIdea(ALL_QUESTIONS.find(q => q.id === 'pin-1'), rng(1));
  assert.equal(named.answer, 'Pin: a piece that cannot move'); assert.ok(named.choices.includes(named.answer));
});

test('stats feed lessons, mistakes and the start-to-finish plan', () => {
  let stats = emptyStats();
  const q = ALL_QUESTIONS[0];
  stats = recordAnswer(stats, { mode: 'flash', question: q, correct: false, ms: 4000 });
  assert.deepEqual(mistakeQueue(stats).map(m => m.id), [q.id]);
  stats = recordAnswer(stats, { mode: 'mistakes', question: q, correct: true, ms: 2000 });
  assert.deepEqual(mistakeQueue(stats), []);
  assert.equal(modeSummary(stats, 'flash').accuracy, 0);
  stats = recordLesson(stats, 'cct', { correctFirstTry: 3, total: 3 });
  assert.equal(stats.lessons.cct.stars, 3);
  stats = recordRun(stats, { mode: 'read', depth: 2, score: 9, total: 10 });
  const plan = planProgress(stats, { reviewedGames: 1 });
  assert.equal(plan.length, PLAN_STAGES.length);
  assert.deepEqual(plan.find(s => s.id === 'thinking').done, 1);
  assert.equal(plan.find(s => s.id === 'read').done, 1);
  assert.equal(plan.find(s => s.id === 'play').done, 1);
  const workout = dailyWorkout({ stats, openings: CHESS_LESSONS.filter(l => l.category === 'Openings'), random: rng(5) });
  assert.ok(workout.length >= 10);
  assert.equal(lessonQuiz('fork', rng(2)).length, 3);
});
