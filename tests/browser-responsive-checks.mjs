import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { createTaskChallenge, createQuestion, formatMoney } from '../quiz-core.mjs';

const games = ['cash', 'memory', 'task', 'error-detection'];
const levels = ['Easy', 'Medium', 'Hard'];

async function fits(page, label) {
  const width = page.viewportSize().width;
  const overflow = await page.evaluate((viewportWidth) => {
    const screen = document.querySelector('.screen:not([hidden])');
    return [...screen.querySelectorAll('*')].filter((element) => {
      if (!element.getClientRects().length || element.closest('.screen-reader-only, .table-wrap')) return false;
      const rect = element.getBoundingClientRect();
      return rect.left < -1 || rect.right > viewportWidth + 1;
    }).map((element) => element.id || element.className || element.tagName);
  }, width);
  assert.deepEqual(overflow, [], `${label}: content fits viewport`);
  assert.ok(await page.evaluate((viewportWidth) => document.documentElement.scrollWidth <= viewportWidth + 1, width), `${label}: no sideways scrolling`);
  if (page.viewportSize().width <= 1024) {
    const smallControls = await page.locator('.screen:not([hidden]) button:visible').evaluateAll((buttons) => buttons
      .filter((button) => button.getBoundingClientRect().height < 44)
      .map((button) => button.id || button.textContent));
    assert.deepEqual(smallControls, [], `${label}: buttons have 44px touch targets`);
    const smallInputs = await page.locator('.screen:not([hidden]) input[type="text"]:visible, .screen:not([hidden]) select:visible').evaluateAll((inputs) => inputs
      .filter((input) => parseFloat(getComputedStyle(input).fontSize) < 16)
      .map((input) => input.id));
    assert.deepEqual(smallInputs, [], `${label}: readable input text`);
  }
}

async function timedPhase(page, game) {
  if (game === 'memory') await page.locator('#memory-answer-now').click();
  if (game === 'task') {
    await page.locator('#task-start-demo').click();
    await page.locator('#task-skip-demo').click();
  }
  if (game === 'error-detection') await page.locator('#error-detection-start-puzzle').click();
}

export async function checkResponsive(browser, base) {
  await checkCustomMemoryAndRequests(browser, base);
  await checkTaskWorkflows(browser, base);
  for (const [width, height] of [[320, 700], [390, 844], [768, 1024], [1024, 768], [1440, 900]]) {
    for (const game of games) {
      for (const level of levels) {
        const page = await browser.newPage({ viewport: { width, height }, hasTouch: width <= 1024, isMobile: width <= 1024 });
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        const label = `${width}px ${game} ${level}`;
        try {
          await page.clock.install();
          await page.goto(base);
          await page.locator(`input[name="game"][value="${game}"]`).check();
          await page.locator(`input[name="difficulty"][value="${level}"]`).check();
          await page.locator('#preset-editor summary').click();
          await fits(page, `${label} preset editor`);
          await page.locator('#save-preset').click();
          await page.locator('#preset-editor summary').click();
          await page.locator(game === 'cash' ? '#question-count' : `#${game}-question-count`).fill('2');
          await page.locator('#auto-continue-toggle').check();
          await page.locator('#distraction-noise-toggle').check();
          if (game === 'cash') {
            await page.locator('#customer-bill-request-toggle').check();
            assert.equal(await page.locator('#cash-builder-toggle').isChecked(), true);
          }
          await page.getByRole('button', { name: 'Start quiz', exact: true }).click();
          await fits(page, `${label} initial phase`);
          const values = game === 'memory' ? await page.locator('#memory-number li span:not(.memory-value-index)').allTextContents() : [];
          await timedPhase(page, game);
          await fits(page, `${label} answering`);
          if (game === 'cash') {
            await page.locator('input[name="answerType"][value="Change"]').check();
            await page.locator('#answer-amount').fill('20.25');
            await page.locator('#quick-cash-entry').fill('1x20, 1Q');
            await page.locator('#apply-quick-cash').click();
            assert.equal(await page.locator('#selected-total').textContent(), 'Selected: $20.25');
            const gesture = width <= 1024 ? 'tap' : 'click';
            await page.locator('.denomination-row').first().getByRole('button').last()[gesture]();
            await page.locator('.denomination-row').first().getByRole('button').first()[gesture]();
            assert.equal(await page.locator('#selected-total').textContent(), 'Selected: $20.25');
            await fits(page, `${label} populated cash builder`);
          } else if (game === 'memory') {
            const inputs = await page.locator('#memory-answer-list input').all();
            for (let index = 0; index < inputs.length; index++) await inputs[index].fill(values[index]);
          } else if (game === 'error-detection') {
            await page.locator('#error-detection-detail-list button').first().click();
          }
          if (width === 320 || width === 768) {
            await page.locator('.screen:not([hidden])').screenshot({ path: resolve(process.env.TEMP || '/tmp', `quiz-${game}-${level}-${width}.png`) });
          }
          const submit = { cash: '#submit-answer', memory: '#memory-answer-form button[type="submit"]', task: '#task-save-workspace', 'error-detection': '#submit-error-detection' }[game];
          await page.locator(submit).click();
          assert.equal(await page.locator('#feedback-screen').isVisible(), false, `${label} answer auto-continues`);
          await fits(page, `${label} second round`);
          await timedPhase(page, game);
          const timer = { cash: 'timer', memory: 'memory-answer-timer', task: 'task-timer', 'error-detection': 'error-detection-timer' }[game];
          const [minutes, seconds] = (await page.locator(`#${timer}`).textContent()).split(':').map(Number);
          await page.clock.runFor((minutes * 60 + seconds) * 1000 + 100);
          await page.locator('#summary-screen').waitFor({ state: 'visible' });
          await fits(page, `${label} summary`);
          assert.deepEqual(errors, [], label);
        } catch (error) {
          await page.screenshot({ path: resolve(process.env.TEMP || '/tmp', 'quiz-responsive-failure.png'), fullPage: true });
          throw error;
        } finally { await page.context().close(); }
      }
      console.log(`${width}px ${game}: all presets, touch controls, answer and timeout continuation passed`);
    }
  }
}

async function checkCustomMemoryAndRequests(browser, base) {
  for (const width of [320, 768]) {
    const page = await browser.newPage({ viewport: { width, height: 800 }, hasTouch: true, isMobile: true });
    try {
      await page.clock.install();
      await page.goto(base);
      await page.locator('input[name="game"][value="memory"]').check();
      await page.locator('#preset-editor summary').click();
      for (const [id, value] of Object.entries({ 'value-min': 3, 'value-max': 3, 'digit-min': 100, 'digit-max': 100 })) {
        await page.locator(`#preset-memory-${id}`).fill(String(value));
      }
      await page.locator('#save-preset').click();
      await page.reload();
      await page.locator('input[name="game"][value="memory"]').check();
      await page.locator('#memory-question-count').fill('1');
      await page.getByRole('button', { name: 'Start quiz', exact: true }).click();
      const values = await page.locator('#memory-number li span:not(.memory-value-index)').allTextContents();
      assert.equal(values.length, 3, 'custom preset survives refresh');
      assert.ok(values.every((value) => value.replace('.', '').length === 100));
      await fits(page, `${width}px 100-digit study values`);
      await timedPhase(page, 'memory');
      const inputs = await page.locator('#memory-answer-list input').all();
      for (let index = 0; index < inputs.length; index++) await inputs[index].fill(values[index]);
      await page.locator('#memory-answer-form button[type="submit"]').click();
      assert.equal(await page.locator('#feedback-heading').textContent(), 'Correct');
      await fits(page, `${width}px 100-digit feedback`);
      await page.locator('#feedback-screen').screenshot({ path: resolve(process.env.TEMP || '/tmp', `quiz-long-memory-${width}.png`) });
      console.log(`${width}px custom memory: saved 100-digit values, correct recall and feedback passed`);
    } finally { await page.context().close(); }

    for (const level of levels) {
      const cashPage = await browser.newPage({ viewport: { width, height: 800 }, hasTouch: true, isMobile: true });
      try {
        await cashPage.addInitScript(() => { Math.random = () => 0.1; });
        await cashPage.clock.install();
        await cashPage.goto(base);
        await cashPage.locator(`input[name="difficulty"][value="${level}"]`).check();
        await cashPage.locator('#question-count').fill('1');
        await cashPage.locator('#customer-bill-request-toggle').check();
        await cashPage.getByRole('button', { name: 'Start quiz', exact: true }).click();
        const question = createQuestion(level, () => 0.1, {}, { customerBillRequests: true });
        assert.equal(await cashPage.locator('#amount-due').textContent(), formatMoney(question.dueCents));
        assert.equal(await cashPage.locator('#customer-bill-request-text').textContent(), question.customerBillRequest.text);
        await cashPage.locator('input[name="answerType"][value="Change"]').check();
        await cashPage.locator('#answer-amount').fill((question.expectedAmountCents / 100).toFixed(2));
        const shorthand = question.customerBillRequest.expectedBreakdown.map(({ cents, count }) => cents >= 100 ? `${count}x${cents / 100}` : `${count}${({ 25: 'Q', 10: 'D', 5: 'N', 1: 'P' })[cents]}`).join(', ');
        await cashPage.locator('#quick-cash-entry').fill(shorthand);
        await cashPage.locator('#apply-quick-cash').click();
        await fits(cashPage, `${width}px ${level} customer request`);
        await cashPage.locator('#submit-answer').click();
        assert.equal(await cashPage.locator('#feedback-heading').textContent(), 'Correct');
        await fits(cashPage, `${width}px ${level} request feedback`);
      } finally { await cashPage.context().close(); }
    }
    console.log(`${width}px customer bill requests: fulfilled correctly at all difficulties`);
  }
}

async function checkTaskWorkflows(browser, base) {
  for (const width of [320, 768, 1024]) {
    for (const random of [0.1, 0.5, 0.9]) {
      const page = await browser.newPage({ viewport: { width, height: 800 }, hasTouch: true, isMobile: true });
      try {
        // Fixed randomness selects each real workspace; production modules are unchanged.
        await page.addInitScript((value) => { Math.random = () => value; }, random);
        await page.clock.install();
        await page.goto(base);
        await page.locator('input[name="game"][value="task"]').check();
        await page.locator('input[name="difficulty"][value="Hard"]').check();
        await page.locator('#preset-editor summary').click();
        for (const [id, value] of Object.entries({ 'step-min': 10, 'step-max': 10, rows: 12, tabs: 5 })) {
          await page.locator(`#preset-task-${id}`).fill(String(value));
        }
        await page.locator('#save-preset').click();
        await page.locator('#task-question-count').fill('1');
        await page.getByRole('button', { name: 'Start quiz', exact: true }).click();
        const challenge = createTaskChallenge('Hard', { minimumSteps: 10, maximumSteps: 10, rows: 12, tabs: 5 }, () => random);
        assert.deepEqual(await page.locator('#task-instruction-list li').allTextContents(), challenge.steps.map((step) => step.instruction));
        await timedPhase(page, 'task');
        for (const step of challenge.steps) {
          const target = page.locator(`#${step.targetId}`);
          assert.equal(await target.isVisible(), true, `${width}px ${challenge.workspace.kind}: ${step.instruction} is reachable`);
          await fits(page, `${width}px ${challenge.workspace.kind}: ${step.instruction}`);
          if (step.type === 'set-text') {
            await target.fill(String(step.value));
            await target.press('Tab');
          } else if (step.type === 'select-option') await target.selectOption(step.value);
          else if (step.type === 'toggle-checkbox') await target.setChecked(step.value);
          else await target.click();
        }
        await page.locator('#feedback-screen').waitFor({ state: 'visible' });
        assert.equal(await page.locator('#feedback-heading').textContent(), 'Correct');
        console.log(`${width}px ${challenge.workspace.kind}: custom 10-step workflow completed correctly`);
      } finally { await page.context().close(); }
    }
  }
}
