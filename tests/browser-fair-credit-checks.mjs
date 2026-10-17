import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { buildProgressModel } from '../progress-analytics.mjs';
const key = 'cash-handling-terminal-quiz-history-v1';
export async function checkFairCredit(browser, base) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  try {
    await page.goto(base);
    await page.locator('input[name="game"][value="memory"]').check();
    await page.locator('#memory-question-count').fill('1');
    await page.locator('#preset-editor summary').click();
    await page.locator('#preset-memory-decimals').uncheck();
    for (const [field, value] of [['value-min', '3'], ['value-max', '3'], ['digit-min', '5'], ['digit-max', '5'], ['write-time', '30']]) await page.locator(`#preset-memory-${field}`).fill(value);
    await page.locator('#save-preset').click();
    await page.getByRole('button', { name: 'Start quiz', exact: true }).click();
    const values = await page.locator('#memory-number li span:not(.memory-value-index)').allTextContents();
    assert.equal(values.length, 3);
    await page.locator('#memory-answer-now').click();
    assert.equal(await page.locator('#memory-number').isVisible(), false);
    const answers = [...values];
    answers[2] = values[2].slice(0, 4) + String((Number(values[2][4]) + 1) % 10);
    for (let i = 0; i < 3; i++) await page.locator(`#memory-answer-${i + 1}`).fill(answers[i]);
    await page.locator('#memory-answer-form button[type="submit"]').click();
    assert.match(await page.locator('#feedback-details').innerText(), /0.67\/1.00/);
    assert.match(await page.locator('#feedback-details').innerText(), /14\/15/);
    assert.match(await page.locator('#feedback-details').innerText(), /93.33%/);
    await page.locator('#next-question').click();
    assert.match(await page.locator('#session-metrics').innerText(), /66.67%/);
    await page.reload(); await page.locator('#open-history').click();
    await page.locator('[data-history-game="memory"]').click();
    assert.match(await page.locator('#memory-credit-history').innerText(), /0.67\/1.00/);
    assert.match(await page.locator('#memory-digit-details').innerText(), /Position 5:/);
    assert.match(await page.locator('#memory-value-digit-heatmap').innerText(), /100% \(1\/1\)/);
    const raw = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
    assert.equal(raw.at(-1).attemptScore, 2 / 3);
    assert.equal(buildProgressModel(raw).accuracyPercent, 66.67);
    // Fresh profile represents a restarted guest with the same exported raw evidence.
    const second = await browser.newContext();
    await second.addInitScript(({ key, raw }) => localStorage.setItem(key, JSON.stringify(raw)), { key, raw });
    const other = await second.newPage(); await other.goto(base); await other.locator('#open-history').click();
    assert.match(await other.locator('#history-metrics').innerText(), /66.67%/); await second.close();
    await mkdir('.artifacts/fair-credit', { recursive: true });
    await page.locator('#memory-value-digit-heatmap').screenshot({ path: '.artifacts/fair-credit/value-digit-heatmap.png' });
    await page.locator('#theme-toggle').click();
    await page.locator('#memory-value-digit-heatmap').screenshot({ path: '.artifacts/fair-credit/value-digit-heatmap-dark.png' });
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `analytics fit ${width}px`);
    }
    for (const [button, size] of [['Minimize All Tables', 'minimized'], ['Expand All Tables', 'expanded'], ['Reset Tables to Default', 'normal']]) {
      await page.getByRole('button', { name: button, exact: true }).click();
      assert.ok((await page.locator('#advanced-error-analytics .history-table-container').evaluateAll(nodes => nodes.map(n => n.dataset.tableSize))).every(s => s === size));
    }
    await page.goto(base); await page.locator('input[name="game"][value="cash"]').check();
    await page.locator('input[name="cashSessionMode"][value="guided"]').check();
    await page.locator('#question-count').fill('1'); await page.getByRole('button', { name: 'Start quiz', exact: true }).click();
    assert.ok(!(await page.locator('#cash-guidance').innerText()).includes(' received − '), 'active guide has no worked answer');
    await page.locator('.cash-working summary').click();
    await page.locator('#cash-working-total').fill('21.00');
    const step = page.locator('.cash-working-row').first();
    for (const [field, value] of [['left', '10.00'], ['right', '10.00'], ['entered', '21.00']]) await step.locator(`[data-field="${field}"]`).fill(value);
    await page.locator('input[name="answerType"][value="Change"]').check(); await page.locator('#answer-amount').fill('18.25');
    await page.locator('#submit-answer').click();
    assert.match(await page.locator('#feedback-details').innerText(), /Step 1: expected \$20.00, entered \$21.00/);
    await page.reload(); await page.locator('#open-history').click(); await page.locator('[data-history-game="cash"]').click();
    assert.match(await page.locator('#cash-step-details').innerText(), /Confirmed/);
    assert.equal(await page.locator('#cash-step-details tbody tr').count(), 1, 'blank rows do not invent intermediate steps');
    await page.goto(base); await page.locator('input[name="game"][value="memory"]').check();
    await page.clock.install();
    await page.getByRole('button', { name: 'Start quiz', exact: true }).click();
    const timeoutValues = await page.locator('#memory-number li span:not(.memory-value-index)').allTextContents();
    await page.locator('#memory-answer-now').click();
    await page.locator('#memory-answer-1').fill(timeoutValues[0]);
    await page.clock.runFor(30100);
    await page.locator('#feedback-screen').waitFor({ state: 'visible' });
    assert.match(await page.locator('#feedback-details').innerText(), /0.33\/1.00/);
    const timeout = await page.evaluate(key => JSON.parse(localStorage.getItem(key)).at(-1), key);
    assert.equal(timeout.outcome, 'Timed Out'); assert.equal(timeout.attemptScore, 1 / 3);
    assert.deepEqual(errors, []);
    console.log('Fair-credit browser checks passed: 2/3 values, 14/15 digits, feedback/session/restart consistency, heatmap, table controls, responsive layouts and recorded cash working.');
  } finally { await context.close(); }
}
