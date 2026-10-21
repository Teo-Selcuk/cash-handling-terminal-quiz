import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SYNC_KEYS } from '../account-data.mjs';

test('Firestore rules allow every synced storage key', () => {
  const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  for (const key of SYNC_KEYS) assert.ok(rules.includes(`'${key}'`), `firestore.rules is missing ${key}`);
});
