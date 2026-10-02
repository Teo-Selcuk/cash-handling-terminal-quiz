export const TYPING_PRESETS = Object.freeze({
  Easy: { characters: 30, seconds: 30 },
  Medium: { characters: 60, seconds: 30 },
  Hard: { characters: 100, seconds: 25 },
});
const WORDS = {
  Easy: 'cat dog sun home book tree green light happy water quick small today music'.split(' '),
  Medium: 'practice balance customer keyboard accuracy careful detail memory forward complete'.split(' '),
  Hard: 'Extraordinary, Precision! Keyboard-42 Verify_Case? Symbols@work Intricate; Rhythm: juxtaposition'.split(' '),
};
const PHRASES = {
  Easy: ['the sun is warm', 'take your time', 'read a good book', 'keep your hands ready'],
  Medium: ['Practice makes progress.', 'Check every detail carefully.', 'Accuracy comes before speed.'],
  Hard: ['Verify #42: total=$19.75!', 'Type {A_B} != [x+y];', 'Case-sensitive: "Ready?" Yes!', 'Send 50% @ 09:30; OK?'],
};
export function resolveTypingSettings(difficulty = 'Easy', overrides = {}) {
  if (!TYPING_PRESETS[difficulty]) throw new Error('Choose Easy, Medium, or Hard.');
  const settings = { ...TYPING_PRESETS[difficulty], mode: 'words', hidePrompt: false, previewSeconds: 5, rounds: 5, ...overrides, difficulty };
  for (const [field, min, max] of [['characters', 1, 500], ['seconds', 3, 300], ['previewSeconds', 1, 60], ['rounds', 1, 100]]) {
    if (!Number.isInteger(settings[field]) || settings[field] < min || settings[field] > max) throw new Error(`${field}: choose a whole number from ${min} to ${max}.`);
  }
  if (!['words', 'phrases', 'random'].includes(settings.mode)) throw new Error('Choose words, phrases, or random characters.');
  return settings;
}
export function createTypingPrompt(settings, random = Math.random) {
  const pick = values => values[Math.min(values.length - 1, Math.floor(random() * values.length))];
  if (settings.mode === 'random') {
    const alphabet = 'abcdefghijklmnopqrstuvwxyz' + (settings.difficulty !== 'Easy' ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' : '') + (settings.difficulty === 'Hard' ? '!@#$%^&*()_+-=[]{};:,.<>/?' : '');
    return Array.from({ length: settings.characters }, () => pick(alphabet)).join('');
  }
  const values = settings.mode === 'phrases' ? PHRASES[settings.difficulty] : WORDS[settings.difficulty];
  let text = '';
  while (text.length < settings.characters) text += (text ? ' ' : '') + pick(values);
  text = text.slice(0, settings.characters);
  // The target is always the requested length, with no invisible trailing space.
  return text.endsWith(' ') ? text.slice(0, -1) + pick('abcdefghijklmnopqrstuvwxyz') : text;
}
export function scoreTyping(expected, answer, elapsedSeconds) {
  const target = Array.from(expected); const typed = Array.from(answer);
  const correctCharacters = target.reduce((sum, char, index) => sum + Number(char === typed[index]), 0);
  const missingCharacters = Math.max(0, target.length - typed.length);
  const extraCharacters = Math.max(0, typed.length - target.length);
  const wrongCharacters = Math.min(target.length, typed.length) - correctCharacters;
  const seconds = Math.max(0.001, Number(elapsedSeconds) || 0.001);
  const cpm = correctCharacters * 60 / seconds;
  return { correct: expected === answer, correctCharacters, wrongCharacters, missingCharacters, extraCharacters,
    accuracyPercent: target.length || typed.length ? Math.round(correctCharacters * 100 / Math.max(target.length, typed.length)) : 100,
    cpm, wpm: cpm / 5 };
}
export function summarizeTyping(history) {
  const rows = history.filter(row => row.game === 'typing' && ['Correct', 'Incorrect', 'Timed Out'].includes(row.outcome));
  const seconds = rows.reduce((sum, row) => sum + row.timeUsedSeconds, 0);
  const correct = rows.reduce((sum, row) => sum + row.correctCharacters, 0);
  const count = rows.reduce((sum, row) => sum + Math.max(row.typingCharacters, Array.from(row.userAnswer ?? '').length), 0);
  return { rounds: rows.length, cpm: seconds ? correct * 60 / seconds : 0, wpm: seconds ? correct * 12 / seconds : 0,
    accuracy: count ? Math.round(correct * 100 / count) : 0, perfect: rows.filter(row => row.outcome === 'Correct').length };
}
