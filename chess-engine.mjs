import { ENGINE_VERSION } from './chess-core.mjs';
import { classifyLoss } from './chess-analytics.mjs';
const abort = () => Object.assign(new Error('Chess request canceled.'), { name: 'AbortError' });

export class ChessEngine {
  constructor({ workerFactory = () => new Worker(new URL('./assets/chess/stockfish-19-lite-single.js', import.meta.url)), onError = () => {} } = {}) {
    this.workerFactory = workerFactory; this.onError = onError; this.worker = null;
    this.generation = 0; this.tail = Promise.resolve(); this.waiter = null; this.initializing = null;
  }
  send(command) { this.worker.postMessage(command); }
  waitFor(match, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.fail(new Error('The chess engine did not respond. Please retry.')), timeout);
      this.waiter = { match, resolve: value => { clearTimeout(timer); this.waiter = null; resolve(value); }, reject: error => { clearTimeout(timer); this.waiter = null; reject(error); } };
    });
  }
  async ready() {
    if (this.initializing) return this.initializing;
    this.initializing = this.initialize().catch(error => { this.initializing = null; throw error; });
    return this.initializing;
  }
  async initialize() {
    this.worker = this.workerFactory();
    this.worker.onmessage = event => {
      for (const line of String(event.data).split('\n')) {
        const waiter = this.waiter;
        if (waiter) { const value = waiter.match(line.trim()); if (value !== undefined) waiter.resolve(value); }
      }
    };
    this.worker.onerror = event => { event.preventDefault?.(); this.fail(new Error('The chess engine could not load. Check the local engine files and retry.')); };
    this.worker.onmessageerror = () => this.fail(new Error('The chess engine sent an unreadable response.'));
    const uci = this.waitFor(line => line === 'uciok' ? true : undefined);
    this.send('uci'); await uci;
    this.send('setoption name Hash value 16'); this.send('setoption name MultiPV value 1');
    const ready = this.waitFor(line => line === 'readyok' ? true : undefined);
    this.send('isready'); await ready;
    return true;
  }
  fail(error) {
    this.waiter?.reject(error); this.worker?.terminate(); this.worker = null;
    this.initializing = null; this.generation++; this.onError(error);
  }
  cancel() { this.generation++; if (this.worker && this.waiter) this.send('stop'); }
  dispose() { this.generation++; this.waiter?.reject(abort()); this.worker?.terminate(); this.worker = null; this.initializing = null; }
  search(positionCommand, positionId, { skill = 20, budgetMs = 250, searchMove = null } = {}) {
    const generation = this.generation;
    const run = async () => {
      if (generation !== this.generation) throw abort();
      await this.ready();
      if (generation !== this.generation) throw abort();
      this.send(`setoption name Skill Level value ${skill}`);
      this.send('setoption name Clear Hash');
      this.send(positionCommand);
      let score = null, pv = [], depth = null;
      const result = this.waitFor(line => {
        const info = line.match(/\bscore (cp|mate) (-?\d+)\b/);
        if (info && !/\b(?:lowerbound|upperbound)\b/.test(line)) {
          score = { type: info[1], value: Number(info[2]) };
          pv = line.match(/\bpv (.+)$/)?.[1].split(' ') ?? [];
          depth = Number(line.match(/\bdepth (\d+)/)?.[1] ?? 0);
        }
        const best = line.match(/^bestmove (\S+)/);
        return best ? { positionId, move: best[1], score, pv, depth, engine: ENGINE_VERSION, budgetMs } : undefined;
      }, Math.max(15000, budgetMs + 5000));
      this.send(`go movetime ${budgetMs}${searchMove ? ` searchmoves ${searchMove}` : ''}`);
      const value = await result;
      if (generation !== this.generation) throw abort();
      return value;
    };
    const result = this.tail.then(run);
    this.tail = result.catch(() => {});
    return result;
  }
}

export function compareEvaluations(best, played) {
  if (!best?.score || !played?.score) return { loss: null, category: 'Unavailable' };
  const a = best.score, b = played.score;
  if (a.type === 'mate' || b.type === 'mate') {
    const missed = a.type === 'mate' && a.value > 0 && !(b.type === 'mate' && b.value > 0);
    const allowed = b.type === 'mate' && b.value < 0 && !(a.type === 'mate' && a.value < 0);
    return { loss: null, category: missed || allowed ? 'Forced mate error' : 'Mate line' };
  }
  const loss = Math.max(0, a.value - b.value);
  return { loss, category: classifyLoss(loss) };
}

export async function analyzeMove(engine, positionCommand, positionId, move, color) {
  const best = await engine.search(positionCommand, positionId);
  const played = await engine.search(positionCommand, positionId, { searchMove: move });
  return { positionId, color, move, best: best.move, score: best.score, playedScore: played.score, pv: best.pv.slice(0, 6), depth: best.depth, playedDepth: played.depth, budgetMs: best.budgetMs, ...compareEvaluations(best, played) };
}
