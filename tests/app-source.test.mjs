import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const appPath = fileURLToPath(new URL('../app.js', import.meta.url));

test('browser application parses as an ES module before deployment', async () => {
  const source = await readFile(appPath, 'utf8');
  const result = spawnSync(process.execPath, ['--check', '--input-type=module'], {
    encoding: 'utf8',
    input: source,
  });

  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
});
