import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { collectModuleGraph, FIREBASE_SDK_URLS } from '../scripts/module-graph.mjs';
import { generateSampleHistory } from '../sample-history.mjs';
import {
  buildErrorAnalytics, buildAdvancedErrorAnalytics, buildProgressModel, filterHistory, deduplicateHistory, clearAnalyticsCache,
} from '../progress-analytics.mjs';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sample = () => JSON.parse(JSON.stringify(generateSampleHistory({ now: new Date('2026-10-17T12:00:00Z') })));

test('startup preloads exactly the modules app.js loads, with matching version queries', () => {
  const preloads = [...html.matchAll(/<link rel="modulepreload" href="([^"]+)">/g)].map((match) => match[1]);
  const script = html.match(/<script type="module" src="([^"]+)">/)[1];
  const expected = [script, ...collectModuleGraph(root), ...FIREBASE_SDK_URLS];
  assert.deepEqual([...preloads].sort(), [...expected].sort());
  assert.equal(new Set(preloads).size, preloads.length, 'no module is preloaded twice');
});

test('every startup module is imported under one URL so the browser loads and runs it once', () => {
  const byFile = new Map();
  for (const href of collectModuleGraph(root)) {
    const file = href.split('?')[0];
    byFile.set(file, [...(byFile.get(file) ?? []), href]);
  }
  const duplicated = [...byFile].filter(([, hrefs]) => hrefs.length > 1);
  assert.deepEqual(duplicated, []);
});

test('the first screen does not wait for the Firebase network', () => {
  const source = readFileSync(new URL('../firebase-accounts.mjs', import.meta.url), 'utf8');
  const start = source.indexOf('export async function initializeAccounts');
  const end = source.indexOf('async function connectAccounts', start);
  const body = source.slice(start, end);
  assert.doesNotMatch(body, /authStateReady|import\('https:/, 'initializeAccounts must not await the SDK or auth');
  assert.match(body, /void connectAccounts\(\)/);
  assert.match(body, /accountStorage\.activate\(rememberedUid\(\)\)/);
  assert.doesNotMatch(source, /location\.reload\(\)/, 'signing in or out switches accounts in place, without a reload');
  assert.match(body, /requestIdleCallback/, 'Firebase starts after the first screen is drawn');
});

test('repeated error analytics for the same attempts come from the cache', () => {
  clearAnalyticsCache();
  const records = sample();
  const started = performance.now();
  const first = buildErrorAnalytics(records, { comparisonDisabled: true });
  const cold = performance.now() - started;
  const again = performance.now();
  const second = buildErrorAnalytics(JSON.parse(JSON.stringify(records)), { comparisonDisabled: true });
  const warm = performance.now() - again;
  assert.equal(second, first, 'same data, parsed again, reuses the result');
  assert.ok(warm < cold / 3 + 20, `cached call ${warm.toFixed(1)}ms should beat cold call ${cold.toFixed(1)}ms`);
});

test('cached analytics never return stale results', () => {
  clearAnalyticsCache();
  const records = sample();
  const base = buildErrorAnalytics(records, { comparisonDisabled: true });
  const edited = records.map((record, index) => (index === 0 ? { ...record, outcome: record.outcome === 'Correct' ? 'Incorrect' : 'Correct' } : record));
  assert.notEqual(buildErrorAnalytics(edited, { comparisonDisabled: true }), base, 'a changed record is recomputed');
  assert.notEqual(buildErrorAnalytics(records, { comparisonDisabled: true, minimumOpportunities: 1 }), base, 'different options are recomputed');
  assert.notEqual(buildErrorAnalytics(records.slice(1), { comparisonDisabled: true }), base, 'a different record list is recomputed');
  assert.notEqual(
    buildErrorAnalytics(records, { comparisonCurrentRecords: records.slice(-5), previousRecords: records.slice(-10, -5) }),
    buildErrorAnalytics(records, { comparisonCurrentRecords: records.slice(-6), previousRecords: records.slice(-10, -6) }),
    'comparison periods are part of the cache key',
  );
});

test('cached results equal freshly computed results', () => {
  const records = sample();
  clearAnalyticsCache();
  const cached = buildErrorAnalytics(records, { comparisonDisabled: true });
  assert.deepEqual(buildErrorAnalytics(records, { comparisonDisabled: true }), cached);
  clearAnalyticsCache();
  assert.deepEqual(buildErrorAnalytics(records, { comparisonDisabled: true }), cached);
  assert.deepEqual(buildAdvancedErrorAnalytics(records), (clearAnalyticsCache(), buildAdvancedErrorAnalytics(records)));
  assert.deepEqual(buildProgressModel(records), (clearAnalyticsCache(), buildProgressModel(records)));
});

test('filtered and de-duplicated lists are copies, so callers can sort or edit them safely', () => {
  clearAnalyticsCache();
  const records = sample();
  const filtered = filterHistory(records, { game: 'cash' });
  const size = filtered.length;
  assert.ok(size > 0);
  filtered.length = 0;
  assert.equal(filterHistory(records, { game: 'cash' }).length, size);
  const rows = deduplicateHistory(records);
  rows.reverse();
  assert.deepEqual(deduplicateHistory(records).map((row) => row.timestampMs), [...rows].reverse().map((row) => row.timestampMs));
});

test('History data for every game is ready fast after the first view', () => {
  clearAnalyticsCache();
  const records = sample();
  const games = ['all', 'cash', 'memory', 'task', 'error-detection', 'fraud-inspection', 'typing', 'overload', 'holds-verification'];
  const build = (game) => {
    const rows = filterHistory(records, { game });
    buildErrorAnalytics(rows, { comparisonDisabled: true });
    buildProgressModel(rows);
    buildAdvancedErrorAnalytics(rows);
  };
  const coldStart = performance.now();
  for (const game of games) build(game);
  const cold = performance.now() - coldStart;
  const warmStart = performance.now();
  for (const game of games) build(game);
  const warm = performance.now() - warmStart;
  assert.ok(cold < 8000, `first pass took ${cold.toFixed(0)}ms`);
  assert.ok(warm < 150, `switching back between games took ${warm.toFixed(0)}ms (first pass ${cold.toFixed(0)}ms)`);
});
