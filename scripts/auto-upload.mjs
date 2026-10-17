// Test, commit, and push one completed change. Never force-pushes or rewrites history.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const DEFAULT_TEST_COMMAND = Object.freeze(['node', '--test', 'tests/*.test.mjs']);

function defaultRun(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', shell: false });
  return { code: result.status ?? 1, output: `${result.stdout ?? ''}${result.stderr ?? ''}${result.error ? result.error.message : ''}` };
}

/**
 * Run the unit tests, then commit and push when they pass.
 * Returns { status, commit?, output } where status is one of
 * 'tests-failed', 'nothing-to-commit', 'pushed', or 'push-failed'.
 */
export function autoUpload({ message, cwd = process.cwd(), remote = 'origin', branch = null,
  testCommand = DEFAULT_TEST_COMMAND, run = defaultRun } = {}) {
  if (!message || !String(message).trim()) throw new Error('A commit message naming the changed section is required.');
  const tests = run(testCommand[0], testCommand.slice(1), cwd);
  if (tests.code !== 0) return { status: 'tests-failed', output: tests.output };
  const git = (...args) => run('git', args, cwd);
  const added = git('add', '-A');
  if (added.code !== 0) return { status: 'commit-failed', output: added.output };
  if (git('diff', '--cached', '--quiet').code === 0) return { status: 'nothing-to-commit', output: '' };
  const committed = git('commit', '-m', message);
  if (committed.code !== 0) return { status: 'commit-failed', output: committed.output };
  const commit = git('rev-parse', 'HEAD').output.trim();
  const target = branch ?? git('rev-parse', '--abbrev-ref', 'HEAD').output.trim();
  // One push attempt only. A failure leaves the local commit in place.
  const pushed = git('push', remote, `HEAD:refs/heads/${target}`);
  return pushed.code === 0 ? { status: 'pushed', commit, output: pushed.output } : { status: 'push-failed', commit, output: pushed.output };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const message = process.argv.slice(2).join(' ');
  const result = autoUpload({ message });
  if (result.status === 'pushed') console.log(`Pushed ${result.commit}.`);
  else if (result.status === 'nothing-to-commit') console.log('Nothing to commit.');
  else {
    console.error(`${result.status}${result.commit ? ` (local commit ${result.commit} kept)` : ''}:\n${result.output}`);
    process.exitCode = 1;
  }
}
