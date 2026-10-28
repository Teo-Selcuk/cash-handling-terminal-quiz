import assert from 'node:assert/strict';
import { APPROVED_UID } from '../account-access.mjs';
import { generateSampleHistory } from '../sample-history.mjs';
import { documentId, recordId } from '../account-data.mjs';
import { routeEmulators } from './browser-firebase-checks.mjs';
const HISTORY_KEY = 'cash-handling-terminal-quiz-history-v1';
const accountModule = './firebase-accounts.mjs?v=20261020-sync';
const email = 'approved@example.com';

// A large offline backlog uploads in the background while the user plays, then reaches a second device.
export async function checkSyncBacklog(browser, base) {
  const password = 'Test-' + crypto.randomUUID();
  await fetch('http://127.0.0.1:9309/emulator/v1/projects/cash-handling-quiz/accounts', { method: 'DELETE' });
  await fetch('http://127.0.0.1:9088/emulator/v1/projects/cash-handling-quiz/databases/(default)/documents', { method: 'DELETE' });
  const created = await fetch('http://127.0.0.1:9309/identitytoolkit.googleapis.com/v1/projects/cash-handling-quiz/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' }, body: JSON.stringify({ localId: APPROVED_UID, email, password, emailVerified: true }) });
  assert.ok(created.ok);
  const records = generateSampleHistory({ count: 700, seed: 5 }).filter((r) => r.game !== 'overload').map((r) => { const c = { ...r }; delete c.isSample; return c; });
  const entries = {};
  let stamp = Date.now() - 1e6;
  for (const record of records) entries[documentId(HISTORY_KEY, recordId(record))] = { key: HISTORY_KEY, value: record, deleted: false, modifiedAt: stamp++, deviceId: 'old-device', pending: true };
  const contexts = [];
  const open = async () => { const context = await browser.newContext(); contexts.push(context); await routeEmulators(context); return context.newPage(); };
  const login = async (page) => {
    await page.locator('#account-area').evaluate((node) => { node.open = true; });
    await page.locator('#account-email').fill(email);
    await page.locator('#account-password').fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  };
  try {
    const a = await open();
    await a.goto(base + 'none');
    await a.evaluate(([uid, saved]) => { localStorage.setItem('cash-trainer-last-uid-v1', uid); localStorage.setItem('cash-trainer-account-cache-v1:' + uid, JSON.stringify(saved)); }, [APPROVED_UID, entries]);
    await a.goto(base);
    await a.waitForFunction(() => document.documentElement.dataset.appReady === 'true');
    await login(a);
    await a.locator('#question-count').fill('1');
    await a.getByRole('button', { name: 'Start quiz', exact: true }).click();
    await a.locator('#answer-form input[value="Exact"]').check();
    await a.locator('#answer-form').evaluate((form) => form.requestSubmit());
    await a.locator('#feedback-screen').waitFor({ timeout: 5000 });
    assert.notEqual(await a.locator('#account-status').textContent(), 'Saved', 'the round was playable while the backlog was still uploading');
    await a.locator('#account-status').filter({ hasText: /^Saved$/ }).waitFor({ timeout: 90000 });
    const total = records.length + 1;
    const b = await open();
    await b.goto(base);
    await b.waitForFunction(() => document.documentElement.dataset.appReady === 'true');
    await login(b);
    await b.waitForFunction(async ({ module, key, count }) => JSON.parse((await import(module)).accountStorage.getItem(key) ?? '[]').length === count, { module: accountModule, key: HISTORY_KEY, count: total }, { timeout: 60000 });
    console.log(`Sync backlog: ${total} records uploaded in the background during play and received by a second device.`);
  } finally { for (const context of contexts) await context.close(); }
}
