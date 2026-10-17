import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { autoUpload } from '../scripts/auto-upload.mjs';

const git = (cwd, ...args) => spawnSync('git', args, { cwd, encoding: 'utf8' });
const pass = ['node', '-e', 'process.exit(0)'];
const fail = ['node', '-e', 'process.exit(1)'];

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'auto-upload-'));
  const remote = join(root, 'remote.git');
  const work = join(root, 'work');
  git(root, 'init', '--bare', '-b', 'work-branch', remote);
  git(root, 'init', '-b', 'work-branch', work);
  for (const [key, value] of [['user.name', 'Test'], ['user.email', 'test@example.com'], ['commit.gpgsign', 'false']]) git(work, 'config', key, value);
  git(work, 'remote', 'add', 'origin', remote);
  writeFileSync(join(work, 'a.txt'), 'one');
  git(work, 'add', '-A'); git(work, 'commit', '-m', 'init'); git(work, 'push', 'origin', 'HEAD:refs/heads/work-branch');
  return { root, remote, work, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}
const remoteHead = (remote) => git(remote, 'rev-parse', 'refs/heads/work-branch').stdout.trim();

test('a passing run creates a commit and pushes it', () => {
  const repo = fixture();
  try {
    writeFileSync(join(repo.work, 'a.txt'), 'two');
    const result = autoUpload({ message: 'Setup layout: equal card sizes', cwd: repo.work, testCommand: pass });
    assert.equal(result.status, 'pushed');
    assert.equal(remoteHead(repo.remote), result.commit);
    assert.equal(git(repo.work, 'log', '-1', '--format=%s').stdout.trim(), 'Setup layout: equal card sizes');
  } finally { repo.cleanup(); }
});

test('a failing test run commits and pushes nothing', () => {
  const repo = fixture();
  try {
    const before = remoteHead(repo.remote);
    const localBefore = git(repo.work, 'rev-parse', 'HEAD').stdout.trim();
    writeFileSync(join(repo.work, 'a.txt'), 'broken');
    const result = autoUpload({ message: 'Docs: notes', cwd: repo.work, testCommand: fail });
    assert.equal(result.status, 'tests-failed');
    assert.equal(remoteHead(repo.remote), before);
    assert.equal(git(repo.work, 'rev-parse', 'HEAD').stdout.trim(), localBefore);
  } finally { repo.cleanup(); }
});

test('a failed push keeps the local commit and reports the error without retrying', () => {
  const repo = fixture();
  try {
    git(repo.work, 'remote', 'set-url', 'origin', join(repo.root, 'missing.git'));
    writeFileSync(join(repo.work, 'a.txt'), 'three');
    const calls = [];
    const run = (command, args, cwd) => {
      calls.push(args[0]);
      const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
      return { code: result.status ?? 1, output: `${result.stdout}${result.stderr}` };
    };
    const result = autoUpload({ message: 'History: explanations', cwd: repo.work, testCommand: pass, run });
    assert.equal(result.status, 'push-failed');
    assert.ok(result.output.length > 0);
    assert.equal(git(repo.work, 'rev-parse', 'HEAD').stdout.trim(), result.commit);
    assert.equal(calls.filter((name) => name === 'push').length, 1);
  } finally { repo.cleanup(); }
});

test('never force-pushes', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../scripts/auto-upload.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /--force|\s-f['"]|\+HEAD/);
});
