import assert from 'node:assert/strict';
import { generateSampleHistory } from '../sample-history.mjs';

export async function checkChartFormatting(browser,base) {
  const template=generateSampleHistory({seed:47}).find(r=>r.game==='typing'&&r.outcome==='Correct');
  const rows=Array.from({length:9},(_,i)=>({...template,isSample:false,attemptId:`precision-${i}`,sessionId:`precision-${i}`,timestamp:new Date(Date.UTC(2026,8,1+i)).toISOString(),difficulty:i%2?'Hard':'Easy',wpm:363.636363636+i/3,accuracyPercent:94.3396226415+i/7}));
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
  try {
    await page.addInitScript(rows=>localStorage.setItem('cash-handling-terminal-quiz-history-v1',JSON.stringify(rows)),rows);
    await page.goto(base);await page.locator('#open-history').click();
    await page.locator('#history-game-tabs button[data-history-game="typing"]').click();
    for(const id of ['typing-speed','typing-character-accuracy']) {
      const chart=page.locator(`[data-chart-id="${id}"]`);
      assert.equal(await chart.locator('.analytics-mark').count(),9);
      const path=await chart.locator('.chart-series-line').getAttribute('d');
      assert.equal((path.match(/L /g)||[]).length,7,'same settings connect across interleaved attempts');
      assert.equal((path.match(/M /g)||[]).length,7,'different settings remain separate path segments');
      const labels=await chart.locator('.chart-value-label,title,.chart-y-tick').allTextContents();
      const aria=await chart.locator('.analytics-mark').evaluateAll(marks=>marks.map(m=>m.getAttribute('aria-label')));
      assert.ok([...labels,...aria].every(s=>! /\d+\.\d{3,}/.test(s)),JSON.stringify(labels));
      await chart.locator('.analytics-mark circle').first().hover();
      assert.ok(!(await chart.textContent()).match(/\d+\.\d{3,}/));
    }
    assert.match(await page.locator('[data-chart-id="typing-speed"] title').first().textContent(),/363\.64 WPM/);
    assert.equal(await page.locator('[data-chart-id="speed-vs-accuracy"] .chart-series-line').count(),0,'category scatter stays unconnected');
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('cash-handling-terminal-quiz-history-v1'))[0].wpm),rows[0].wpm,'saved precision remains intact');
    await page.locator('[data-chart-id="typing-speed"]').screenshot({path:(process.env.TEMP||'/tmp')+'/typing-connected-chart.png'});
    console.log('Chart formatting browser checks passed: connected related points, two-decimal labels/tooltips, WPM units and unchanged saved precision.');
  } finally {await context.close();}
}
