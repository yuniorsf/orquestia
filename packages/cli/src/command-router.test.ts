import { describe, expect, it } from 'vitest';
import { CommandRouter } from './command-router.js';
import { FakeCommand } from './test-builders.js';

describe('CommandRouter.run', () => {
  it('renders help listing every registered command when called with no args', async () => {
    const router = new CommandRouter([
      new FakeCommand('approvals', 'Manage approval gates'),
      new FakeCommand('plan', 'Run the Planning DAG'),
    ]);

    const result = await router.run([]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('approvals');
    expect(result.stdout).toContain('Manage approval gates');
    expect(result.stdout).toContain('plan');
  });

  it('renders help for --help', async () => {
    const router = new CommandRouter([new FakeCommand('approvals', 'Manage approval gates')]);

    const result = await router.run(['--help']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Usage: orquestia <command> [args...]');
  });

  it('renders help for -h', async () => {
    const router = new CommandRouter([new FakeCommand('approvals', 'Manage approval gates')]);

    const result = await router.run(['-h']);

    expect(result.exitCode).toBe(0);
  });

  it('reports an unknown command without dispatching anything', async () => {
    const command = new FakeCommand('approvals', 'Manage approval gates');
    const router = new CommandRouter([command]);

    const result = await router.run(['bogus']);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Unknown command "bogus"');
    expect(command.calls).toEqual([]);
  });

  it('dispatches a known command with its remaining args', async () => {
    const command = new FakeCommand('approvals', 'Manage approval gates', {
      exitCode: 0,
      stdout: 'ok\n',
      stderr: '',
    });
    const router = new CommandRouter([command]);

    const result = await router.run(['approvals', 'list', 'task-1']);

    expect(result).toEqual({ exitCode: 0, stdout: 'ok\n', stderr: '' });
    expect(command.calls).toEqual([['list', 'task-1']]);
  });
});
