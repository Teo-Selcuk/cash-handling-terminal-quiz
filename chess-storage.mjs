import { validateSavedGame } from './chess-core.mjs';
export const CHESS_KEYS = { games: 'cash-handling-chess-games-v1', lessons: 'cash-handling-chess-lessons-v1', current: 'cash-handling-chess-current-v1' };
export class ChessStore {
  constructor(storage = globalThis.localStorage) { this.storage = storage; }
  read(key, fallback) {
    const text = this.storage.getItem(CHESS_KEYS[key]);
    if (!text) return fallback;
    const data = JSON.parse(text);
    if (data?.version !== 1 || !('value' in data)) throw new Error('Saved chess data is unreadable. Existing data has been preserved.');
    return data.value;
  }
  write(key, value) { this.storage.setItem(CHESS_KEYS[key], JSON.stringify({ version: 1, value })); }
  games() { const value = this.read('games', []); if (!Array.isArray(value)) throw new Error('Saved chess games are unreadable.'); value.forEach(validateSavedGame); return value; }
  lessons() { const value = this.read('lessons', []); if (!Array.isArray(value) || !value.every(l => typeof l.id === 'string' && typeof l.lessonId === 'string' && Number.isFinite(Date.parse(l.startedAt)) && ['hints', 'moves', 'retries'].every(k => Number.isInteger(l[k]) && l[k] >= 0))) throw new Error('Saved lessons are unreadable.'); return value; }
  current() { const record = this.read('current', null); return record ? validateSavedGame(record) : null; }
  saveGame(record) { const games = this.games(); const index = games.findIndex(g => g.id === record.id); if (index < 0) games.push(record); else games[index] = record; this.write('games', games); }
  saveCurrent(record) { this.write('current', record); }
  clearCurrent(id) { if (this.current()?.id === id) this.storage.removeItem(CHESS_KEYS.current); }
  saveLesson(record) { const lessons = this.lessons(); const index = lessons.findIndex(l => l.id === record.id); if (index < 0) lessons.push(record); else lessons[index] = record; this.write('lessons', lessons); }
}
