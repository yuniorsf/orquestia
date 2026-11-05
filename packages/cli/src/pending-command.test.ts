import { describe, expect, it } from 'vitest';
import { PendingCommand } from './pending-command.js';

describe('PendingCommand', () => {
  it('exposes its name and summary', () => {
    const command = new PendingCommand('queue', 'Inspect the worktree task queue', 'the daemon');

    expect(command.name).toBe('queue');
    expect(command.summary).toBe('Inspect the worktree task queue');
  });

  it('reports a non-zero exit code with a message explaining what blocks it', async () => {
    const command = new PendingCommand('queue', 'Inspect the worktree task queue', 'the daemon');

    const result = await command.run();

    expect(result).toEqual({
      exitCode: 1,
      stdout: '',
      stderr: '"queue" is not available yet — blocked on the daemon.\n',
    });
  });
});
