import { Chess, DEFAULT_POSITION, validateFen } from './assets/chess/chess.mjs';
export { Chess, DEFAULT_POSITION };
export const DIFFICULTIES = { Beginner: 0, Easy: 3, Medium: 10, Hard: 20 };
export const ENGINE_VERSION = 'Stockfish 19 lite single / 19.0.0';

export function validateSavedGame(record) {
  if (record?.version !== 1 || typeof record.id !== 'string' || !record.id || !validateFen(record.startFen ?? '').ok
    || !['w', 'b'].includes(record.player) || !Number.isFinite(Date.parse(record.startedAt)) || !Array.isArray(record.moves)
    || !record.moves.every(move => typeof move.san === 'string' && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move.uci) && ['w', 'b'].includes(move.color) && Number.isFinite(move.elapsedMs) && move.elapsedMs >= 0 && validateFen(move.before ?? '').ok && validateFen(move.after ?? '').ok)
    || !['w', 'b'].every(color => Number.isFinite(record.remaining?.[color]) && record.remaining[color] >= 0 && Number.isInteger(record.lateCount?.[color]) && record.lateCount[color] >= 0)
    || !Number.isFinite(record.turnElapsed) || record.turnElapsed < 0 || !Number.isInteger(record.hints) || record.hints < 0
    || !Number.isInteger(record.feedbackUsed) || record.feedbackUsed < 0
    || (record.result !== null && (!record.result || !['w', 'b', null].includes(record.result.winner) || typeof record.result.reason !== 'string'))
    || !record.analysis || !Array.isArray(record.analysis.rows)) throw new Error('Saved chess game is unreadable. Existing data has been preserved.');
  normalizeSettings(record.settings);
  return record;
}

export function normalizeSettings(input = {}) {
  const settings = { difficulty: 'Easy', color: 'w', timeControl: 'untimed', minutes: 5, increment: 0, secondsPerMove: 30, coaching: false, ...input };
  if (!Object.hasOwn(DIFFICULTIES, settings.difficulty) || !['w', 'b', 'random'].includes(settings.color) || !['untimed', 'clock', 'move'].includes(settings.timeControl)) throw new Error('Choose valid chess settings.');
  settings.skillLevel ??= DIFFICULTIES[settings.difficulty];
  for (const [key, min, max] of [['skillLevel', 0, 20], ['minutes', 1, 60], ['increment', 0, 30], ['secondsPerMove', 1, 300]]) {
    settings[key] = Number(settings[key]);
    if (!Number.isInteger(settings[key]) || settings[key] < min || settings[key] > max) throw new Error(`${key} must be a whole number from ${min} to ${max}.`);
  }
  settings.coaching = Boolean(settings.coaching);
  return settings;
}

export function gameEnding(chess) {
  if (chess.isCheckmate()) return { winner: chess.turn() === 'w' ? 'b' : 'w', reason: 'Checkmate' };
  if (chess.isStalemate()) return { winner: null, reason: 'Stalemate' };
  if (chess.isThreefoldRepetition()) return { winner: null, reason: 'Threefold repetition' };
  if (chess.isInsufficientMaterial()) return { winner: null, reason: 'Insufficient material' };
  if (chess.isDrawByFiftyMoves()) return { winner: null, reason: 'Fifty-move rule' };
  return null;
}

// A flag cannot award a win to a bare king or a lone minor without mating possibilities.
export function canMate(chess, color) {
  const pieces = chess.board().flat().filter(Boolean);
  const own = pieces.filter(p => p.color === color && p.type !== 'k');
  const other = pieces.filter(p => p.color !== color && p.type !== 'k');
  if (!own.length || chess.isInsufficientMaterial()) return false;
  if (own.some(p => ['p', 'r', 'q'].includes(p.type))) return true;
  if (own.some(p => p.type === 'n')) return own.length >= 2 || other.length > 0;
  const squareColor = p => (p.square.charCodeAt(0) + Number(p.square[1])) % 2;
  const colors = new Set(own.map(squareColor));
  return colors.size > 1 || other.some(p => p.type !== 'b' || !colors.has(squareColor(p)));
}

export class ChessSession {
  constructor(settings, { fen = DEFAULT_POSITION, now = Date.now(), id = globalThis.crypto.randomUUID(), lessonId = null } = {}) {
    this.settings = normalizeSettings(settings);
    this.id = id; this.startFen = fen; this.chess = new Chess(fen);
    this.player = this.settings.color === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : this.settings.color;
    this.startedAt = new Date(now).toISOString(); this.endedAt = null;
    this.moves = []; this.remaining = { w: this.settings.minutes * 60000, b: this.settings.minutes * 60000 };
    this.lateCount = { w: 0, b: 0 }; this.turnStarted = now; this.turnElapsed = 0;
    this.paused = false; this.resumed = false; this.interrupted = false;
    this.turnLate = false; this.hints = 0; this.feedbackUsed = 0; this.lessonId = lessonId;
    this.analysis = { status: 'pending', engine: ENGINE_VERSION, budgetMs: 250, rows: [] };
    this.result = gameEnding(this.chess);
  }
  positionId() { return `${this.id}:${this.moves.length}:${this.chess.fen()}`; }
  positionCommand() { return `position fen ${this.startFen}${this.moves.length ? ` moves ${this.moves.map(m => m.uci).join(' ')}` : ''}`; }
  clock(now = Date.now()) {
    const running = !this.paused && !this.result;
    const delta = running ? Math.max(0, now - this.turnStarted) : 0;
    return { remaining: { ...this.remaining, [this.chess.turn()]: Math.max(0, this.remaining[this.chess.turn()] - delta) }, elapsedMs: this.turnElapsed + delta };
  }
  tick(now = Date.now()) {
    if (this.result || this.paused) return;
    const clock = this.clock(now), color = this.chess.turn();
    if (this.settings.timeControl === 'clock' && clock.remaining[color] <= 0) {
      const winner = color === 'w' ? 'b' : 'w';
      this.finish(canMate(this.chess, winner) ? winner : null, canMate(this.chess, winner) ? 'Time expired' : 'Time expired — no mating material', now);
    } else if (this.settings.timeControl === 'move' && clock.elapsedMs >= this.settings.secondsPerMove * 1000 && !this.turnLate) {
      this.turnLate = true; this.lateCount[color]++;
    }
  }
  move(input, now = Date.now()) {
    this.tick(now);
    if (this.result || this.paused) throw new Error('This game is finished or paused.');
    const color = this.chess.turn(), before = this.chess.fen(), clock = this.clock(now);
    const move = this.chess.move(input);
    this.remaining[color] = clock.remaining[color] + (this.settings.timeControl === 'clock' ? this.settings.increment * 1000 : 0);
    this.moves.push({ san: move.san, uci: move.from + move.to + (move.promotion ?? ''), color, before, after: this.chess.fen(), elapsedMs: clock.elapsedMs, late: this.turnLate });
    this.turnStarted = now; this.turnElapsed = 0; this.turnLate = false;
    const ending = gameEnding(this.chess);
    if (ending) this.finish(ending.winner, ending.reason, now);
    return move;
  }
  pause(now = Date.now(), interrupted = true) {
    this.tick(now);
    if (this.paused || this.result) return;
    const clock = this.clock(now);
    this.remaining = clock.remaining; this.turnElapsed = clock.elapsedMs; this.paused = true;
    if (interrupted) this.interrupted = true;
  }
  resume(now = Date.now()) { if (!this.result) { this.paused = false; this.turnStarted = now; } }
  finish(winner, reason, now = Date.now()) {
    if (this.result) return;
    this.remaining = this.clock(now).remaining;
    this.result = { winner, reason }; this.endedAt = new Date(now).toISOString();
  }
  snapshot(now = Date.now()) {
    const clock = this.clock(now);
    return JSON.parse(JSON.stringify({ version: 1, id: this.id, settings: this.settings, player: this.player, startFen: this.startFen, startedAt: this.startedAt, endedAt: this.endedAt,
      moves: this.moves, remaining: clock.remaining, turnElapsed: clock.elapsedMs, turnLate: this.turnLate, lateCount: this.lateCount,
      result: this.result, resumed: this.resumed, interrupted: this.interrupted, hints: this.hints, feedbackUsed: this.feedbackUsed, lessonId: this.lessonId, analysis: this.analysis }));
  }
  static restore(record, now = Date.now()) {
    validateSavedGame(record);
    const game = new ChessSession(record.settings, { fen: record.startFen, now, id: record.id, lessonId: record.lessonId });
    for (const move of record.moves) {
      if (game.chess.fen() !== move.before) throw new Error('Saved chess move history is inconsistent.');
      const played = game.chess.move(move.san);
      if (played.from + played.to + (played.promotion ?? '') !== move.uci || game.chess.fen() !== move.after) throw new Error('Saved chess move history is inconsistent.');
    }
    for (const key of ['player', 'startedAt', 'endedAt', 'moves', 'remaining', 'turnElapsed', 'turnLate', 'lateCount', 'result', 'hints', 'feedbackUsed', 'analysis', 'interrupted']) game[key] = record[key];
    game.resumed = true; game.turnStarted = now;
    return game;
  }
  pgn() {
    this.chess.setHeader('Event', 'Local chess practice', 'White', this.player === 'w' ? 'Player' : this.settings.difficulty + ' computer', 'Black', this.player === 'b' ? 'Player' : this.settings.difficulty + ' computer', 'Result', !this.result ? '*' : this.result.winner === 'w' ? '1-0' : this.result.winner === 'b' ? '0-1' : '1/2-1/2');
    this.chess.setHeader('BotSkillLevel', String(this.settings.skillLevel));
    return this.chess.pgn();
  }
}
