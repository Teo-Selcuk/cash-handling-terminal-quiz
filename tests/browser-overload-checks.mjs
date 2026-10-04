import assert from 'node:assert/strict';
import { TASKS } from '../overload-core.mjs';
import { resolve } from 'node:path';

export async function checkOverload(browser, site) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on('pageerror', error => errors.push(error.stack));
  const key = 'cash-handling-terminal-quiz-history-v1';
  async function setup(count, included = TASKS.map(t => t.id), mode = 'practice', seconds = 60) {
    await page.goto(site);
    await page.locator('[name="game"][value="overload"]').check();
    await page.locator('#overload-mode').selectOption(mode);
    await page.locator('#overload-startingTasks').fill(String(count));
    await page.locator('#overload-maxTasks').fill(String(count));
    await page.locator('#overload-unlockAll').check();
    await page.locator('#overload-autoAdd').uncheck();
    await page.locator('#overload-timerSeconds').fill(String(seconds));
    await page.locator('#overload-setup-options details').evaluate(node => node.open = true);
    for (const task of TASKS) await page.locator(`#overload-include-${task.id}`).setChecked(included.includes(task.id));
    await page.getByRole('button', { name: 'Start quiz', exact: true }).click();
    await page.locator('#overload-screen').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.overload-panel').count(), count);
  }
  const history = () => page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '[]').filter(r => r.game === 'overload'), key);
  try {
    for (let count = 1; count <= 9; count++) {
      await setup(count);
      const initial = await page.locator('.overload-remaining').allTextContents();
      await page.waitForTimeout(220);
      assert.notDeepEqual(await page.locator('.overload-remaining').allTextContents(), initial);
      await page.getByRole('button', { name: 'Pause', exact: true }).click();
      const paused = await page.locator('.overload-scoreboard').textContent();
      await page.waitForTimeout(200);
      assert.equal(await page.locator('.overload-scoreboard').textContent(), paused);
      await page.getByRole('button', { name: 'Resume', exact: true }).click();
      await page.getByRole('button', { name: 'End run', exact: true }).click();
      assert.equal((await history()).at(-1).overloadPeakTasks, count);
    }
    for (const task of TASKS) {
      await setup(1, [task.id], 'practice', task.id === 'ball' ? 3 : 60);
      const card = page.locator('.overload-panel'), choices = card.locator('.overload-task-content button');
      if (task.id === 'math') {
        const expression = await card.locator('.overload-prompt').textContent();
        const [a, operator, b] = expression.match(/(-?\d+)\s*([+−×-])\s*(-?\d+)/).slice(1);
        await card.locator('input').fill(String(operator === '+' ? +a + +b : operator === '×' ? +a * +b : +a - +b));
        await card.locator('input').press('Enter');
      } else if (task.id === 'color') {
        const color = await card.locator('.overload-prompt').evaluate(node => node.style.color);
        const answer = { 'rgb(195, 49, 49)': 'red', 'rgb(36, 103, 192)': 'blue', 'rgb(34, 112, 68)': 'green', 'rgb(141, 105, 0)': 'gold' }[color];
        await card.getByRole('button', { name: answer, exact: true }).click();
      } else if (task.id === 'arrows') {
        const opposite = { '↑': 'ArrowDown', '↓': 'ArrowUp', '←': 'ArrowRight', '→': 'ArrowLeft' }[await card.locator('.overload-prompt').textContent()];
        await card.focus(); await page.keyboard.press(opposite);
      } else if (task.id === 'shapes') {
        const labels = await choices.allTextContents(); const i = labels.findIndex((label, index) => labels.indexOf(label) !== index), j = labels.indexOf(labels[i]);
        await choices.nth(j).click(); await choices.nth(i).click();
      } else if (task.id === 'cards') {
        const labels = await choices.allTextContents(); const i = labels.findIndex((label, index) => labels.indexOf(label) !== index), j = labels.indexOf(labels[i]);
        await page.waitForTimeout(1900); await choices.nth(j).click(); await choices.nth(i).click();
      } else if (task.id === 'pattern') {
        const sequence = (await card.locator('.overload-prompt').textContent()).match(/\d+/g).map(Number);
        await page.waitForTimeout(1900); for (const value of sequence) await choices.nth(value - 1).click();
      } else if (task.id === 'wires') {
        const labels = await card.locator('.overload-wires > div:first-child button').allTextContents();
        for (const label of labels) { await card.getByRole('button', { name: label, exact: true }).click(); await card.getByRole('button', { name: label.replace('Left', 'Right'), exact: true }).click(); }
      } else if (task.id === 'mole') {
        await card.locator('.mole-target').waitFor(); await card.locator('.mole-target').click();
      } else {
        const lane = await card.locator('.overload-ball').evaluate(node => Math.round((parseFloat(node.style.left) - 10) / 20));
        await choices.nth(lane).click(); await page.waitForTimeout(3100);
      }
      assert.ok((await history()).at(-1).overloadScore >= 1, `${task.id} correct control response saves score`);
      await page.getByRole('button', { name: 'End run', exact: true }).click();
    }
    await setup(1, ['math'], 'standard');
    await page.locator('.overload-panel input').fill('incorrect'); await page.locator('.overload-panel input').press('Enter');
    await page.locator('.overload-result').waitFor(); assert.equal((await history()).at(-1).overloadEndingReason, 'mistake');
    for (const mode of ['endurance', 'custom']) { await setup(2, undefined, mode); await page.getByRole('button', { name: 'End run', exact: true }).click(); assert.equal((await history()).at(-1).sessionMode, mode); }
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 }); await setup(9);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `no overflow at ${width}`);
      const boxes = await page.locator('.overload-panel').evaluateAll(nodes => nodes.map(n => { const r=n.getBoundingClientRect(); return {width:r.width,left:r.left,right:r.right}; }));
      assert.ok(boxes.every(box => box.width >= 230 && box.left >= 0 && box.right <= width + 1));
      if (width === 1440) await page.locator('#overload-screen').screenshot({ path: resolve(process.env.TEMP || '/tmp', 'quiz-overload-desktop.png') });
      await page.getByRole('button', { name: 'End run', exact: true }).click();
    }
    await page.setViewportSize({ width:1440, height:1000 });
    await page.getByRole('button', { name: 'History / Progress', exact: true }).click();
    assert.ok(await page.locator('#overload-history-rows tr').count() >= 24);
    await page.locator('#overload-history-rows button').first().click(); assert.ok(await page.locator('#attempt-detail-content table').count() >= 2);
    await page.locator('#close-attempt-detail').click();
    const real = await page.evaluate(key => localStorage.getItem(key), key);
    await page.locator('#history-data-source input[value="sample"]').check();
    assert.ok(await page.locator('#overload-history-rows tr').count() >= 200);
    assert.equal(await page.locator('#history-charts .interactive-chart').count(), 11);
    assert.ok(await page.locator('#history-error-category-table tbody tr').count() > 5);
    assert.match(await page.locator('#overload-history-evidence').textContent(), /Most reliable/);
    assert.ok(await page.locator('#history-recommendations .practice-recommendation').count() <= 1);
    for (const id of ['overload-score','overload-accuracy','overload-response','overload-survival','overload-peak']) {
      const chart = page.locator(`[data-chart-id="${id}"]`); assert.ok(await chart.locator('.chart-series-line').count());
      const labels = await chart.locator('svg text, td, .chart-selection-summary').allTextContents();
      for (const label of labels) assert.ok(!/\d+\.\d{3,}/.test(label), `${id} label uses at most two decimals: ${label}`);
    }
    const shell = page.locator('#overload-history-rows').locator('xpath=ancestor::div[contains(@class,"history-table-container")]');
    await shell.getByRole('button', { name: 'Minimize Table', exact: true }).click(); assert.equal(await shell.locator('.history-table-viewport').isVisible(),false);
    await shell.getByRole('button', { name: 'Expand Table', exact: true }).click(); assert.equal(await shell.locator('.history-table-viewport').isVisible(),true);
    await shell.getByRole('button', { name: 'Normal Table', exact: true }).click();
    for (const task of TASKS) assert.ok((await page.locator('#overload-task-rows').textContent()).includes(task.name));
    assert.equal(await page.evaluate(key => localStorage.getItem(key), key), real);
    await page.evaluate(key => {
      const sample=JSON.parse(sessionStorage.getItem('cash-handling-terminal-quiz-sample-history-v1'));
      const rows=Array.isArray(sample)?sample:sample.records;
      localStorage.setItem(key,JSON.stringify(rows.map(({isSample,...row})=>row)));
    },key);
    await page.reload();
    await page.locator('[name="game"][value="overload"]').check();
    await page.locator('#overload-setup-options details').evaluate(node => node.open = true);
    await page.locator('#overload-unlock-arrows').fill('777');
    await page.locator('#open-history').click(); await page.locator('[data-history-game="overload"]').click();
    await page.locator('#history-recommendations').getByRole('button',{name:'Use practice plan',exact:true}).click();
    assert.equal(await page.locator('[name="game"][value="overload"]').isChecked(),true);
    assert.equal(await page.locator('#overload-mode').inputValue(),'practice');
    assert.equal(await page.locator('#overload-autoAdd').isChecked(),false);
    assert.equal(await page.locator('#overload-unlock-arrows').inputValue(),'20');
    await page.getByRole('button',{name:'Start quiz',exact:true}).click(); await page.locator('#overload-screen').waitFor({state:'visible'});
    await page.getByRole('button',{name:'End run',exact:true}).click();
    assert.deepEqual(errors, []);
    console.log('OVERLOAD: all nine controls, 1–9 concurrent panels, pause, modes, responsive layout, persistence and analytics passed.');
  } finally { await page.close(); }
}
