import { describe, expect, it } from 'vitest';
import { FakeCommandRunnerPort } from '../coding/test-builders.js';
import { GitWorktreeDiffPort } from './git-worktree-diff-port.js';

const COMMAND = 'git diff --numstat HEAD';

describe('GitWorktreeDiffPort', () => {
  it('parses a numstat line into a structured file diff', async () => {
    const commandRunner = new FakeCommandRunnerPort({
      [COMMAND]: { exitCode: 0, stdout: '3\t1\tsrc/foo.ts\n', stderr: '' },
    });
    const port = new GitWorktreeDiffPort(commandRunner);

    const summary = await port.summarize('/worktrees/ORQ-28');

    expect(summary).toEqual({
      worktreePath: '/worktrees/ORQ-28',
      files: [{ path: 'src/foo.ts', insertions: 3, deletions: 1 }],
    });
  });

  it('parses multiple files and skips blank trailing lines', async () => {
    const commandRunner = new FakeCommandRunnerPort({
      [COMMAND]: {
        exitCode: 0,
        stdout: '3\t1\tsrc/foo.ts\n10\t0\tsrc/bar.ts\n\n',
        stderr: '',
      },
    });
    const port = new GitWorktreeDiffPort(commandRunner);

    const summary = await port.summarize('/worktrees/ORQ-28');

    expect(summary.files).toEqual([
      { path: 'src/foo.ts', insertions: 3, deletions: 1 },
      { path: 'src/bar.ts', insertions: 10, deletions: 0 },
    ]);
  });

  it('returns no files when there is nothing to diff', async () => {
    const commandRunner = new FakeCommandRunnerPort({
      [COMMAND]: { exitCode: 0, stdout: '', stderr: '' },
    });
    const port = new GitWorktreeDiffPort(commandRunner);

    const summary = await port.summarize('/worktrees/ORQ-28');

    expect(summary.files).toEqual([]);
  });

  it('falls back to 0 and an empty path for a malformed/binary-marker numstat line', async () => {
    const commandRunner = new FakeCommandRunnerPort({
      [COMMAND]: { exitCode: 0, stdout: '-\t-\tassets/logo.png\n', stderr: '' },
    });
    const port = new GitWorktreeDiffPort(commandRunner);

    const summary = await port.summarize('/worktrees/ORQ-28');

    expect(summary.files).toEqual([{ path: 'assets/logo.png', insertions: 0, deletions: 0 }]);
  });

  it('defaults the path to an empty string when the line has no third field', async () => {
    const commandRunner = new FakeCommandRunnerPort({
      [COMMAND]: { exitCode: 0, stdout: '1\t2\n', stderr: '' },
    });
    const port = new GitWorktreeDiffPort(commandRunner);

    const summary = await port.summarize('/worktrees/ORQ-28');

    expect(summary.files).toEqual([{ path: '', insertions: 1, deletions: 2 }]);
  });
});
