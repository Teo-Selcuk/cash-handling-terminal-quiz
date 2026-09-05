// Run with Playwright available on NODE_PATH. Uses a fresh, muted browser profile.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const server = createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname;
  const file = path === '/' ? 'index.html' : path.slice(1);
  if (!['index.html', 'app.js', 'style.css', 'quiz-core.mjs', 'pattern-games.mjs', 'distraction-sounds.mjs'].includes(file)) {
    response.writeHead(404).end(); return;
  }
  response.setHeader('Content-Type', ({ '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript' })[extname(file)]);
  response.end(await readFile(resolve(root, file)));
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
let browser;
try {
  browser = await chromium.launch({ headless: true, args: ['--mute-audio'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.addInitScript(() => {
    window.audioProbe = { contexts: [], sources: [] };
    const NativeAudioContext = window.AudioContext;
    window.AudioContext = class extends NativeAudioContext {
      constructor(...args) { super(...args); window.audioProbe.contexts.push(this); }
      createBufferSource() {
        const source = super.createBufferSource();
        const record = { source, stopped: false, analyser: null };
        const stop = source.stop.bind(source);
        source.stop = (...args) => { record.stopped = true; return stop(...args); };
        const connect = source.connect.bind(source);
        source.connect = (...args) => {
          record.analyser = this.createAnalyser();
          record.analyser.fftSize = 256;
          connect(record.analyser);
          return connect(...args);
        };
        window.audioProbe.sources.push(record);
        return source;
      }
    };
  });
  const base = process.env.QUIZ_LIVE_URL || `http://127.0.0.1:${server.address().port}/`;
  const audioState = () => page.evaluate(() => ({
    total: audioProbe.sources.length,
    active: audioProbe.sources.filter((record) => !record.stopped).length,
    running: audioProbe.contexts.some((context) => context.state === 'running'),
  }));
  await page.goto(base);
  assert.equal(await page.locator('#distraction-noise-toggle').isChecked(), false);
  await page.locator('#question-count').fill('1');
  await page.getByRole('button', { name: 'Start quiz', exact: true }).click();
  assert.equal((await audioState()).total, 0, 'default session stays silent');

  // A full 15-round deck at each difficulty must visit every family exactly once.
  for (const level of ['Easy', 'Medium', 'Hard']) {
    await page.setViewportSize({ width: level === 'Hard' ? 320 : 1280, height: 900 });
    await page.goto(base);
    await page.locator('input[name="game"][value="error-detection"]').check();
    await page.locator(`input[name="difficulty"][value="${level}"]`).check();
    await page.locator('#error-detection-question-count').fill('15');
    await page.locator('#distraction-noise-toggle').check();
    await page.getByRole('button', { name: 'Start quiz', exact: true }).click();
    const titles = new Set();
    for (let round = 1; round <= 15; round += 1) {
      await page.locator('#error-detection-briefing-screen').waitFor({ state: 'visible' });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'briefing fits viewport');
      titles.add(await page.locator('#error-detection-briefing-title').textContent());
      assert.equal(await page.locator('#error-detection-rule-steps li').count(), ['Easy', 'Medium', 'Hard'].indexOf(level) + 2);
      await page.locator('#error-detection-start-puzzle').click();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'puzzle fits viewport');
      if (level === 'Hard' && await page.locator('#error-detection-title').textContent() === 'Interleaved streams') {
        await page.screenshot({ path: resolve(process.env.TEMP || '/tmp', 'quiz-pattern-games-mobile.png'), fullPage: true });
      }
      await page.waitForFunction(() => audioProbe.sources.some((record) => !record.stopped));
      assert.deepEqual(await audioState(), { total: 1, active: 1, running: true });
      if (round === 1) {
        await page.waitForFunction(() => {
          const record = audioProbe.sources[0];
          const data = new Float32Array(256);
          record.analyser.getFloatTimeDomainData(data);
          return data.some((value) => Math.abs(value) > 0.01);
        });
      }
      await page.locator('#error-detection-no-errors').check();
      await page.locator('#submit-error-detection').click();
      assert.equal((await audioState()).active, round === 15 ? 0 : 1, 'feedback keeps audio until final answer');
      await page.locator('#next-question').click();
    }
    await page.locator('#summary-screen').waitFor({ state: 'visible' });
    assert.equal(titles.size, 15);
    assert.equal((await audioState()).active, 0);
    console.log(`${level}: 15 families, 15 completed rounds, continuous audio and final cleanup passed`);
  }
  await page.goto(base);
  await page.locator('#question-count').fill('2');
  await page.locator('#time-limit').fill('3');
  await page.locator('#auto-continue-toggle').check();
  await page.locator('#distraction-noise-toggle').check();
  await page.getByRole('button', { name: 'Start quiz', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#question-progress').textContent.includes('2 of 2'));
  assert.deepEqual(await audioState(), { total: 1, active: 1, running: true });
  await page.locator('#summary-screen').waitFor({ state: 'visible' });
  assert.equal((await audioState()).active, 0);
  console.log('Cash: timeout auto-advance keeps one audio source and stops at completion');

  for (const game of ['memory', 'task']) {
    await page.goto(base);
    await page.locator(`input[name="game"][value="${game}"]`).check();
    await page.locator(`#${game}-question-count`).fill('2');
    await page.locator('#distraction-noise-toggle').check();
    await page.getByRole('button', { name: 'Start quiz', exact: true }).click();
    for (let round = 1; round <= 2; round += 1) {
      if (game === 'memory') {
        await page.locator('#memory-answer-now').click();
        for (const input of await page.locator('#memory-answer-list input').all()) await input.fill('1');
      } else {
        await page.locator('#task-start-demo').click();
        await page.locator('#task-skip-demo').click();
      }
      await page.waitForFunction(() => audioProbe.sources.some((record) => !record.stopped));
      assert.equal((await audioState()).total, 1);
      await page.locator(game === 'memory' ? '#memory-answer-form button[type="submit"]' : '#task-save-workspace').click();
      assert.equal((await audioState()).active, round === 2 ? 0 : 1);
      await page.locator('#next-question').click();
    }
    await page.locator('#summary-screen').waitFor({ state: 'visible' });
    console.log(`${game}: round transitions and final cleanup passed`);
  }
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `setup fits ${width}px`);
    await page.locator('input[name="game"][value="error-detection"]').check();
    await page.getByRole('button', { name: 'Start quiz', exact: true }).click();
    await page.locator('#error-detection-start-puzzle').click();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `puzzle fits ${width}px`);
  }
  await page.screenshot({ path: resolve(process.env.TEMP || '/tmp', 'quiz-pattern-games.png'), fullPage: true });
  assert.deepEqual(errors, []);
  console.log('Responsive layouts passed at 320/768/1440px; no page errors or failed asset requests.');
} finally {
  await browser?.close();
  server.close();
}
