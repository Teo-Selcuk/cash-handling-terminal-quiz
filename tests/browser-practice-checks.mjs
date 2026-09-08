import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { answer } from './browser-history-checks.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const key = 'cash-handling-terminal-quiz-history-v1';
const presetsKey = 'cash-handling-terminal-quiz-presets-v1';
const server = createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname;
  const file = path === '/' ? 'index.html' : path.slice(1);
  if (!['index.html', 'app.js', 'style.css', 'quiz-core.mjs', 'pattern-games.mjs', 'distraction-sounds.mjs', 'adaptive-practice.mjs'].includes(file)) {
    response.writeHead(404).end(); return;
  }
  response.setHeader('Content-Type', ({ '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript' })[extname(file)]);
  response.end(await readFile(resolve(root, file)));
});
const fixtures = (game) => Array.from({ length: 6 }, (_, i) => ({
  game, gameType: ({ cash: 'Cash handling', memory: 'Number memory', task: 'Task simulation', 'error-detection': 'Error detection' })[game],
  difficulty: 'Easy', sessionId: 'fixture', questionNumber: i + 1,
  timestamp: new Date(Date.UTC(2026, 8, 1, 0, i)).toISOString(), outcome: 'Incorrect',
  ...(game === 'cash' ? { amountDueCents: 7525, cashGivenCents: 8525, timeLimitSeconds: 30, sessionMode: 'Testing' }
    : game === 'memory' ? { expectedValues: ['1234567'], answeredValues: ['1234560'], valueCount: 1, readTimeSeconds: 5, writeTimeSeconds: 10 }
      : game === 'task' ? { workspaceKind: 'invoice', stepsExpected: 5, timeLimitSeconds: 75 }
        : { puzzleFamilyId: 'cipher-check', detailCount: 5, expectedErrorCount: 1, correctlyFlagged: 0, falseFlagCount: 1, timeLimitSeconds: 35 }),
}));
const savedHistory = (page) => page.evaluate((storageKey) => JSON.parse(localStorage.getItem(storageKey)), key);

await new Promise((done) => server.listen(0, '127.0.0.1', done));
const base = process.env.QUIZ_LIVE_URL || `http://127.0.0.1:${server.address().port}/`;
let browser;
try {
  browser = await chromium.launch({ headless: true, args: ['--mute-audio'] });
  await mkdir(resolve(root, '.artifacts'), { recursive: true });
  for (const game of ['cash', 'memory', 'task', 'error-detection']) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
    await page.addInitScript(({ storageKey, rows }) => {
      if (localStorage.getItem(storageKey) === null) localStorage.setItem(storageKey, JSON.stringify(rows));
    }, { storageKey: key, rows: fixtures(game) });
    try {
      await page.goto(base);
      await page.locator(`input[name="game"][value="${game}"]`).check();
      assert.equal(await page.locator('#setup-recommendations .practice-recommendation').count(), 1);
      await page.locator('#setup-recommendations summary').click();
      assert.match(await page.locator('#setup-recommendations').textContent(), /6 of 6/);
      const beforePresets = await page.evaluate((k) => localStorage.getItem(k), presetsKey);
      await page.locator('#setup-recommendations button').click();
      assert.equal(await page.locator('#active-practice').isVisible(), true);
      await page.locator('#auto-continue-toggle').check();
      await page.locator(game === 'cash' ? '#question-count' : `#${game}-question-count`).fill(game === 'memory' ? '10' : '1');
      assert.equal(await page.locator('#active-practice').isVisible(), true);
      await page.getByRole('button', { name: 'Start quiz', exact: true }).click();
      const initial = (await savedHistory(page)).at(-1);
      assert.equal(initial.outcome, 'Not answered');
      assert.ok(initial.practicePlanJson);
      assert.ok(initial.settingsJson);
      if (game === 'cash') {
        assert.ok(initial.amountDueCents >= 5000 && initial.amountDueCents < 10000);
        assert.ok(initial.cashGivenCents > initial.amountDueCents);
      }
      if (game === 'memory') assert.deepEqual(initial.digitsByValue, [6]);
      if (game === 'task') { assert.equal(initial.workspaceKind, 'invoice'); assert.equal(initial.stepsExpected, 4); }
      if (game === 'error-detection') { assert.equal(initial.puzzleFamilyId, 'cipher-check'); assert.equal(initial.detailCount, 4); }
      for (let i = 0; i < (game === 'memory' ? 10 : 1); i += 1) await answer(page, game);
      await page.locator('#summary-screen').waitFor({ state: 'visible' });
      assert.ok(await page.locator('#summary-recommendations .practice-recommendation').count());
      const records = await savedHistory(page);
      const completed = records.filter((r) => r.sessionId === initial.sessionId);
      assert.ok(completed.every((r) => r.sessionCompletedAt && r.outcome !== 'Not answered'));
      assert.equal(await page.evaluate((k) => localStorage.getItem(k), presetsKey), beforePresets);
      if (game === 'memory') {
        await page.locator('#summary-recommendations button').first().click();
        assert.match(await page.locator('#active-practice-settings').textContent(), /Digits per value6/);
        await page.getByRole('button', { name: 'Start quiz', exact: true }).click();
        for (let i = 0; i < 10; i += 1) await answer(page, game);
        await page.locator('#summary-screen').waitFor({ state: 'visible' });
        assert.match(await page.locator('#summary-recommendations').textContent(), /Increase one step/);
        assert.match(await page.locator('#summary-recommendations').textContent(), /20 of 20/);
        await page.reload();
        await page.locator('input[name="game"][value="memory"]').check();
        await page.locator('#setup-recommendations button').first().click();
        assert.match(await page.locator('#active-practice-settings').textContent(), /Digits per value7/);
        await page.getByRole('button', { name: 'Start quiz', exact: true }).click();
        assert.deepEqual((await savedHistory(page)).at(-1).digitsByValue, [7]);
        await page.reload();
      }
      await page.locator('#open-history').click();
      assert.equal(await page.locator('#history-recommendations > section').count(), 4);
      await page.locator('#history-recommendations summary').first().click();
      for (const width of [320, 390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${game}: fits ${width}px`);
      }
      if (game === 'memory') {
        await page.screenshot({ path: resolve(root, '.artifacts/practice-history-desktop.png'), fullPage: true });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.screenshot({ path: resolve(root, '.artifacts/practice-history-mobile.png'), fullPage: true });
      }
      await page.locator('#recommendation-level').selectOption('Hard');
      assert.equal(await page.locator('#history-recommendations .practice-recommendation').count(), 0);
      await page.locator('#recommendation-level').selectOption('Easy');
      await page.locator('#history-recommendations button').first().click();
      await page.locator('#clear-practice-plan').click();
      assert.equal(await page.locator('#active-practice').isVisible(), false);
      await page.locator('#open-history').click();
      page.once('dialog', (dialog) => dialog.accept());
      await page.locator('#clear-history').click();
      assert.equal(await page.locator('#history-recommendations .practice-recommendation').count(), 0);
      assert.deepEqual(errors, []);
      console.log(`${game}: evidence, apply, focused generation, completed history, presets, clear and responsive checks passed`);
    } finally { await context.close(); }
  }
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
}
