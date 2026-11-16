import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

// Every game on phones and tablets, held both ways: no sideways scrolling, 44px touch targets,
// and 16px text in fields (smaller text makes iPhones zoom the page when a field is tapped).
const GAMES = ['cash', 'math', 'quick-add', 'memory', 'task', 'error-detection', 'fraud-inspection', 'typing', 'overload', 'chess'];
const SIZES = [[390, 844], [844, 390], [768, 1024], [1024, 768]];

async function touchProblems(page) {
  return page.evaluate(width => {
    const screen = [...document.querySelectorAll('.screen:not([hidden])')].pop() ?? document.body;
    const shown = e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && !e.closest('.screen-reader-only');
    const name = e => e.id || (e.textContent || e.className).trim().slice(0, 30);
    const problems = [];
    const outside = [...screen.querySelectorAll('*')].filter(e => shown(e) && !e.closest('.table-wrap') && (e.getBoundingClientRect().left < -1 || e.getBoundingClientRect().right > width + 1));
    if (outside.length) problems.push(`off screen: ${[...new Set(outside.map(name))].slice(0, 5).join(', ')}`);
    if (document.documentElement.scrollWidth > width + 1) problems.push(`page scrolls sideways (${document.documentElement.scrollWidth}px)`);
    // Inline links inside a sentence are exempt, as in WCAG 2.5.8.
    const controls = [...screen.querySelectorAll('button, [role="button"], a, select, summary, input[type="checkbox"], input[type="radio"]')]
      .filter(e => shown(e) && !e.classList.contains('chess-square') && !(e.matches('a') && e.closest('p')));
    const small = controls.filter(e => { const box = (e.matches('input') ? e.closest('label') ?? e : e).getBoundingClientRect(); return box.height < 44 || box.width < 32; });
    if (small.length) problems.push(`small touch targets: ${small.map(e => `${name(e)} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`).slice(0, 6).join(', ')}`);
    const tiny = [...screen.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=range]), select, textarea')].filter(e => shown(e) && parseFloat(getComputedStyle(e).fontSize) < 16);
    if (tiny.length) problems.push(`field text under 16px: ${tiny.map(e => e.id || e.name).slice(0, 6).join(', ')}`);
    return problems;
  }, page.viewportSize().width);
}

export async function checkTouch(browser, base) {
  await mkdir('.artifacts/touch', { recursive: true });
  for (const [width, height] of SIZES) for (const game of GAMES) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true });
    const page = await context.newPage(); const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const label = `${width}x${height} ${game}`;
    try {
      await page.goto(base);
      await page.locator('#setup-form:not([inert])').waitFor();
      const choice = page.locator(`input[name="game"][value="${game}"]`);
      if (await choice.isDisabled()) { // Sign-in-only game: check its setup options as a guest would see them.
        await page.evaluate(g => { document.querySelector(`input[name="game"][value="${g}"]`).disabled = false; }, game);
      }
      await choice.check({ force: true });
      if (game === 'chess') await page.locator('#chess-setup-status').filter({ hasText: 'Computer ready' }).waitFor({ timeout: 30000 });
      assert.deepEqual(await touchProblems(page), [], `${label} setup`);
      if (game === 'fraud-inspection') { await context.close(); continue; }
      await page.locator('#setup-form button[type="submit"]').click();
      await page.waitForTimeout(800);
      assert.deepEqual(await touchProblems(page), [], `${label} first screen`);
      const begin = { memory: '#memory-answer-now', task: '#task-start-demo', 'error-detection': '#error-detection-start-puzzle' }[game];
      if (begin) {
        await page.locator(begin).tap();
        if (game === 'task') await page.locator('#task-skip-demo').tap();
        await page.waitForTimeout(400);
        assert.deepEqual(await touchProblems(page), [], `${label} answering`);
      }
      if (game === 'chess') {
        // A real finger tap on the realistic 3D board moves a piece.
        await page.waitForFunction(() => document.querySelector('#chess-board').chessView?.ready, null, { timeout: 30000 });
        await page.locator('#chess-board').scrollIntoViewIfNeeded(); await page.waitForTimeout(400);
        for (const square of ['e2', 'e4']) { const point = await page.evaluate(sq => document.querySelector('#chess-board').chessView.screenPoint(sq), square); await page.touchscreen.tap(point.x, point.y); }
        await page.locator('#chess-moves li').first().waitFor();
        assert.match(await page.locator('#chess-moves li').first().textContent(), /e4/, `${label}: tap moves a piece`);
        assert.deepEqual(await touchProblems(page), [], `${label} after a move`);
        await page.locator('#chess-trainer-open').tap(); await page.locator('[data-trainer-tab="flash"]').tap(); await page.locator('#chess-trainer-start').tap();
        assert.deepEqual(await touchProblems(page), [], `${label} trainer`);
      }
      await page.screenshot({ path: `.artifacts/touch/${game}-${width}x${height}.png` });
      assert.deepEqual(errors, [], `${label} page errors`);
    } finally { await context.close(); }
  }
  console.log('Touch checks passed: every game on phones and tablets in both orientations.');
}
