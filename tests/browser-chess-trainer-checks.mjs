import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { DRILL_QUESTIONS } from '../chess-trainer.mjs';
// These checks click the square buttons, so they use the tilted CSS view; the realistic WebGL view has its own check.
const preferTilt = context => context.addInitScript(() => { if (!localStorage.getItem('cash-handling-chess-board-v1')) localStorage.setItem('cash-handling-chess-board-v1', JSON.stringify({ view: 'tilt', theme: 'green' })); });

// Find the right answer for the card on screen by its question text and choices.
async function rightAnswer(page) {
  const ask = await page.locator('#chess-trainer-ask').textContent();
  const choices = await page.locator('.trainer-choice').evaluateAll(nodes => nodes.map(node => node.dataset.choice));
  return DRILL_QUESTIONS.find(q => q.ask === ask && q.choices.every(c => choices.includes(c)))?.answer ?? null;
}

export async function checkChessTrainer(browser, base) {
  await mkdir('.artifacts/chess', { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } }); await preferTilt(context);
  const page = await context.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  try {
    await page.goto(base);
    await page.locator('input[name="game"][value="chess"]').check({ force: true });
    await page.locator('#chess-open-trainer').click();
    await page.locator('#chess-trainer').waitFor();
    assert.equal(await page.locator('.trainer-plan > li').count(), 8, 'eight plan stages');
    assert.equal(await page.locator('#chess-trainer-board').evaluate(n => n.classList.contains('is-3d')), true, '3D board by default');
    assert.ok(await page.locator('#chess-trainer-board .chess-arrows line').count() >= 1, 'plan board shows arrows');
    await page.screenshot({ path: '.artifacts/chess/trainer-plan-1440.png' });

    // Lessons: idea -> demo -> quiz; a wrong answer is explained and comes back.
    await page.locator('[data-trainer-tab="lessons"]').click();
    assert.ok(await page.locator('.trainer-lesson-card').count() >= 20);
    await page.locator('[data-concept="fork"]').click();
    assert.match(await page.locator('.trainer-yes').textContent(), /Use it when/);
    await page.locator('#chess-trainer-demo').click();
    await page.locator('#chess-trainer-demo-play').click(); // pause autoplay
    while (!(await page.locator('#chess-trainer-demo-step').isDisabled())) await page.locator('#chess-trainer-demo-step').click();
    assert.equal(await page.locator('.trainer-demo-notes li.is-past, .trainer-demo-notes li.is-current').count(), 3);
    assert.match(await page.locator('#chess-trainer-board [data-trainer-square="a8"]').getAttribute('aria-label'), /White knight/);
    await page.screenshot({ path: '.artifacts/chess/trainer-demo-1440.png' });
    await page.locator('#chess-trainer-quiz').click();
    // First card: play the fork on the board.
    assert.equal(await rightAnswer(page), 'Nd6+');
    await page.locator('[data-trainer-square="b5"]').click(); await page.locator('[data-trainer-square="d6"]').click();
    await page.locator('.trainer-right').waitFor();
    await page.keyboard.press('Enter');
    // Second card: answer wrong on purpose.
    const answer = await rightAnswer(page);
    const wrong = (await page.locator('.trainer-choice').evaluateAll(nodes => nodes.map(n => n.dataset.choice))).find(c => c !== answer);
    await page.locator(`.trainer-choice[data-choice="${wrong}"]`).click();
    assert.match(await page.locator('.trainer-wrong').textContent(), /Not quite/);
    assert.match(await page.locator('#chess-trainer-feedback').textContent(), /come back/);
    await page.screenshot({ path: '.artifacts/chess/trainer-wrong-1440.png' });
    await page.locator('#chess-trainer-next').click();
    for (let i = 0; i < 6 && !(await page.locator('#chess-trainer-result').count()); i++) {
      const right = await rightAnswer(page);
      await page.locator(`.trainer-choice[data-choice="${right}"]`).click();
      await page.locator('#chess-trainer-next').click();
    }
    await page.locator('#chess-trainer-result').waitFor();
    assert.match(await page.locator('#chess-trainer-result h4').textContent(), /Lesson complete ★★☆/);
    const stats = await page.evaluate(() => JSON.parse(localStorage.getItem('cash-handling-chess-trainer-v1')));
    assert.equal(stats.lessons.fork.completed, true);

    // Flash drill with a timer, answered by keyboard.
    await page.locator('[data-trainer-tab="flash"]').click();
    await page.locator('#chess-trainer-start').click();
    assert.equal(await page.locator('#chess-trainer-timer').isVisible(), true);
    for (let i = 0; i < 3; i++) { await page.keyboard.press('1'); await page.locator('#chess-trainer-next').waitFor(); await page.keyboard.press('Enter'); }
    await page.getByRole('button', { name: 'Quit', exact: true }).click();
    await page.locator('#chess-trainer-result').waitFor();

    // Read ahead: moves are listed, the board does not move until you answer.
    await page.locator('[data-trainer-tab="read"]').click();
    await page.locator('select[name="depth"]').selectOption('3');
    await page.locator('#chess-trainer-start').click();
    assert.ok((await page.locator('.trainer-line').textContent()).split(' ').length >= 3);
    const before = await page.locator('#chess-trainer-board').evaluate(n => [...n.querySelectorAll('[aria-label]')].map(b => b.getAttribute('aria-label')).join());
    await page.waitForTimeout(400);
    assert.equal(await page.locator('#chess-trainer-board').evaluate(n => [...n.querySelectorAll('[aria-label]')].map(b => b.getAttribute('aria-label')).join()), before, 'board stays still');
    await page.screenshot({ path: '.artifacts/chess/trainer-read-1440.png' });
    await page.keyboard.press('2'); await page.locator('#chess-trainer-next').waitFor();
    await page.getByRole('button', { name: 'Quit', exact: true }).click();

    // Quick analysis from the puzzle bank.
    await page.locator('[data-trainer-tab="analysis"]').click();
    await page.locator('#chess-trainer-start').click();
    const right = await rightAnswer(page);
    await page.locator(`.trainer-choice[data-choice="${right}"]`).click();
    await page.locator('.trainer-right').waitFor();
    await page.getByRole('button', { name: 'Quit', exact: true }).click();

    // Mistakes collect wrong answers.
    await page.locator('[data-trainer-tab="mistakes"]').click();
    assert.ok(await page.locator('.trainer-mistakes li').count() >= 1);

    // Board look: 3D toggle and theme apply to both boards; Esc returns to the board.
    await page.locator('#chess-trainer-close').click();
    assert.equal(await page.locator('#chess-trainer').isVisible(), false);
    await page.locator('#chess-theme').selectOption('wood');
    assert.equal(await page.locator('#chess-board').getAttribute('data-board-theme'), 'wood');
    await page.locator('#chess-trainer-open').click();
    assert.equal(await page.locator('#chess-trainer-board').getAttribute('data-board-theme'), 'wood');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#chess-trainer').isVisible(), false);

    // Phone width: no sideways scroll.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#chess-trainer-open').click();
    await page.locator('[data-trainer-tab="lessons"]').click();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'trainer fits 390px');
    await page.screenshot({ path: '.artifacts/chess/trainer-lessons-390.png', fullPage: true });
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  await checkRealisticBoard(browser, base);
}

// The default view is a WebGL board: moves are made by clicking where squares appear on screen.
async function checkRealisticBoard(browser, base) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await context.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  try {
    await page.goto(base);
    await page.locator('input[name="game"][value="chess"]').check({ force: true });
    await page.locator('#chess-setup-status').filter({ hasText: 'Computer ready' }).waitFor();
    await page.locator('#chess-color').selectOption('w'); await page.locator('#chess-time-control').selectOption('untimed');
    await page.getByRole('button', { name: 'Start chess game', exact: true }).click();
    await page.locator('#chess-status').filter({ hasText: 'Your turn' }).waitFor();
    await page.waitForFunction(() => document.querySelector('#chess-board').chessView?.ready, null, { timeout: 30000 });
    assert.equal(await page.locator('#chess-view').inputValue(), 'real');
    assert.equal(await page.locator('#chess-board').evaluate(n => n.classList.contains('uses-webgl') && Boolean(n.querySelector('canvas.chess-webgl'))), true);
    const click = async square => { const p = await page.evaluate(sq => document.querySelector('#chess-board').chessView.screenPoint(sq), square); await page.mouse.click(p.x, p.y); };
    await page.waitForTimeout(300);
    await click('e2'); assert.equal(await page.locator('[data-square="e2"]').getAttribute('aria-pressed'), 'true');
    await click('e4'); await page.locator('#chess-moves li').nth(1).waitFor();
    assert.match(await page.locator('#chess-moves li').first().textContent(), /e4/);
    // Keyboard still works through the hidden square buttons.
    await page.locator('[data-square="d2"]').focus(); await page.keyboard.press('Enter'); await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp'); await page.keyboard.press('Enter');
    await page.locator('#chess-moves li').nth(3).waitFor();
    await page.locator('#chess-flip').click(); await page.waitForTimeout(800);
    await page.screenshot({ path: '.artifacts/chess/realistic-1280.png' });
    await page.locator('#chess-view').selectOption('flat');
    assert.equal(await page.locator('#chess-board').evaluate(n => n.classList.contains('uses-webgl') || n.classList.contains('is-3d')), false, 'flat view');
    await page.setViewportSize({ width: 390, height: 844 }); await page.locator('#chess-view').selectOption('real'); await page.waitForTimeout(500);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'realistic board fits 390px');
    await page.locator('#chess-resign').click();
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
}
