import { normalizeSettings } from './chess-core.mjs';
export const classifyLoss = loss => loss === null || !Number.isFinite(loss) ? 'Unavailable' : loss >= 200 ? 'Blunder' : loss >= 100 ? 'Mistake' : loss >= 50 ? 'Inaccuracy' : 'Good';
const average = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
export function filterChessGames(games, filters = {}) {
  return games.filter(game => (!filters.difficulty || game.settings.difficulty === filters.difficulty)
    && (!filters.timeControl || game.settings.timeControl === filters.timeControl)
    && (!filters.startDate || game.startedAt.slice(0, 10) >= filters.startDate)
    && (!filters.endDate || game.startedAt.slice(0, 10) <= filters.endDate)
    && (!filters.practice || filters.practice === 'all'
      || (filters.practice === 'uninterrupted' && !game.resumed && !game.interrupted && !game.lessonId && !game.hints && !game.feedbackUsed && !game.settings.coaching)
      || (filters.practice === 'assisted' && (game.hints > 0 || game.feedbackUsed > 0 || game.settings.coaching))
      || (filters.practice === 'resumed' && (game.resumed || game.interrupted))
      || (filters.practice === 'lesson' && game.lessonId)));
}
export function summarizeChess(games, lessons = []) {
  const finished = games.filter(g => g.result), playerMoves = finished.flatMap(g => g.moves.filter(m => m.color === g.player));
  const reviewed = finished.flatMap(g => (g.analysis?.rows ?? []).filter(m => m.color === g.player));
  const deadlineMoves = finished.filter(g => g.settings.timeControl === 'move').flatMap(g => g.moves.filter(m => m.color === g.player));
  const losses = reviewed.map(m => m.loss).filter(Number.isFinite);
  const wins = finished.filter(g => g.result.winner === g.player).length;
  const draws = finished.filter(g => g.result.winner === null).length;
  return { games: finished.length, wins, draws, losses: finished.length - wins - draws, winRate: finished.length ? wins / finished.length * 100 : null,
    averageMoveSeconds: average(playerMoves.map(m => m.elapsedMs / 1000)), lateMoves: playerMoves.filter(m => m.late).length,
    lateRate: deadlineMoves.length ? deadlineMoves.filter(m => m.late).length / deadlineMoves.length * 100 : null,
    averageLoss: average(losses), evaluatedMoves: losses.length, mistakes: reviewed.filter(m => ['Mistake', 'Blunder', 'Forced mate error'].includes(m.category)).length,
    inaccuracies: reviewed.filter(m => m.category === 'Inaccuracy').length,
    completedLessons: new Set(lessons.filter(l => l.completed).map(l => l.lessonId)).size, lessonAttempts: lessons.length, lessonHints: lessons.reduce((n, l) => n + l.hints, 0) };
}
export function chessChartSpecs(games, lessons = []) {
  const chart = (id, title, points, metric = 'attempts', kind = 'bar', axisLabel = 'Games') => ({ id: `chess-${id}`, title, description: 'Saved local chess practice. Quiz answer accuracy is excluded.', kind, axisLabel, evidenceUnit: id === 'lessons' ? 'lesson attempts' : 'games', series: [{ id: 'chess', label: title, metric, points }], attemptIds: points.flatMap(p => p.attemptIds ?? []) });
  const point = (label, value, rows) => ({ key: label, label, value, count: rows.length, attemptIds: rows.map(g => g.id) });
  const grouped = key => [...new Set(games.map(key))].map(label => { const rows = games.filter(g => key(g) === label); return point(label, summarizeChess(rows).winRate, rows); });
  const summary = summarizeChess(games, lessons);
  const time = games.map((g, i) => point(`Game ${i + 1}`, summarizeChess([g]).averageMoveSeconds, [g])).filter(p => p.value !== null);
  return [
    chart('outcomes', 'Wins, draws and losses', ['Wins', 'Draws', 'Losses'].map(label => { const rows = games.filter(g => g.result && (label === 'Wins' ? g.result.winner === g.player : label === 'Draws' ? g.result.winner === null : g.result.winner !== null && g.result.winner !== g.player)); return point(label, rows.length, rows); })),
    chart('difficulty', 'Win rate by computer difficulty', grouped(g => `${g.settings.difficulty} · ${normalizeSettings(g.settings).skillLevel}/20`), 'accuracy', 'bar', 'Win rate (%)'),
    chart('clock', 'Win rate by time control', grouped(g => g.settings.timeControl), 'accuracy', 'bar', 'Win rate (%)'),
    chart('move-time', 'Your move time over games', time, 'time', 'line', 'Seconds per move'),
    chart('late', 'Your late moves over games', games.filter(g => g.settings.timeControl === 'move').map((g, i) => point(`Game ${i + 1}`, summarizeChess([g]).lateMoves, [g])), 'attempts', 'line', 'Late moves'),
    chart('mistakes', 'Evaluated move errors', ['Inaccuracy', 'Mistake', 'Blunder', 'Forced mate error'].map(k => point(k, games.flatMap(g => (g.analysis?.rows ?? []).filter(m => m.color === g.player && m.category === k)).length, games.filter(g => (g.analysis?.rows ?? []).some(m => m.color === g.player && m.category === k)))), 'attempts', 'bar', 'Moves'),
    chart('lessons', 'Lessons completed', [{ key: 'Completed', label: 'Completed', value: summary.completedLessons, count: lessons.filter(l => l.completed).length, attemptIds: lessons.filter(l => l.completed).map(l => l.id) }, { key: 'Remaining', label: 'Remaining', value: 24 - summary.completedLessons, count: 0, attemptIds: [] }], 'attempts', 'bar', 'Lessons'),
  ].filter(spec => spec.series[0].points.length);
}
export function chessCsv(games) {
  const escape = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const columns = ['id', 'startedAt', 'difficulty', 'timeControl', 'result', 'reason', 'playerMoves', 'averageMoveSeconds', 'lateMoves', 'averageCentipawnLoss', 'evaluatedMoves', 'assisted', 'resumed', 'lessonId', 'analysisStatus', 'engine', 'skillLevel'];
  return [columns, ...games.map(g => { const s = summarizeChess([g]); return [g.id, g.startedAt, g.settings.difficulty, g.settings.timeControl, !g.result ? 'In progress' : g.result.winner === null ? 'Draw' : g.result.winner === g.player ? 'Win' : 'Loss', g.result?.reason, g.moves.filter(m => m.color === g.player).length, s.averageMoveSeconds, s.lateMoves, s.averageLoss, s.evaluatedMoves, Boolean(g.settings.coaching || g.hints || g.feedbackUsed), Boolean(g.resumed || g.interrupted), g.lessonId, g.analysis?.status, g.analysis?.engine, normalizeSettings(g.settings).skillLevel]; })].map(row => row.map(escape).join(',')).join('\r\n');
}
