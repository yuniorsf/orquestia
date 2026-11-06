import type { DaemonClientPort } from '@orquestia/core';
import { describe, expect, it } from 'vitest';
import type { DaemonProcessLauncher } from './queue-command.js';
import { QueueCommand } from './queue-command.js';

class FakeDaemonClientPort implements DaemonClientPort {
  readonly calls: Array<{ method: string; params: unknown }> = [];

  constructor(private readonly resultsByMethod: ReadonlyMap<string, unknown> = new Map()) {}

  async call(method: string, params?: unknown): Promise<unknown> {
    this.calls.push({ method, params });
    if (!this.resultsByMethod.has(method)) {
      throw new Error(`no result configured for method "${method}"`);
    }
    return this.resultsByMethod.get(method);
  }
}

class FakeDaemonProcessLauncher implements DaemonProcessLauncher {
  spawnCalls = 0;

  async spawn(): Promise<void> {
    this.spawnCalls += 1;
  }
}

const PING_OK = new Map([['daemon.ping', { pid: 4242, uptimeSeconds: 125.7 }]]);

describe('QueueCommand', () => {
  it('reports usage for an unknown action', async () => {
    const command = new QueueCommand(
      new FakeDaemonClientPort(),
      new FakeDaemonProcessLauncher(),
      'origin/develop',
    );

    const result = await command.run(['bogus']);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Usage: orquestia queue');
  });

  describe('start', () => {
    it('reports already running without spawning when the daemon responds to a ping', async () => {
      const launcher = new FakeDaemonProcessLauncher();
      const command = new QueueCommand(
        new FakeDaemonClientPort(PING_OK),
        launcher,
        'origin/develop',
      );

      const result = await command.run(['start']);

      expect(result).toEqual({
        exitCode: 0,
        stdout: 'Orquestia daemon is already running.\n',
        stderr: '',
      });
      expect(launcher.spawnCalls).toBe(0);
    });

    it('spawns the daemon when no one is listening', async () => {
      const launcher = new FakeDaemonProcessLauncher();
      const command = new QueueCommand(new FakeDaemonClientPort(), launcher, 'origin/develop');

      const result = await command.run(['start']);

      expect(result).toEqual({ exitCode: 0, stdout: 'Orquestia daemon started.\n', stderr: '' });
      expect(launcher.spawnCalls).toBe(1);
    });
  });

  describe('stop', () => {
    it('reports success when the daemon acknowledges daemon.stop', async () => {
      const command = new QueueCommand(
        new FakeDaemonClientPort(new Map([['daemon.stop', { stopping: true }]])),
        new FakeDaemonProcessLauncher(),
        'origin/develop',
      );

      const result = await command.run(['stop']);

      expect(result).toEqual({ exitCode: 0, stdout: 'Orquestia daemon stopped.\n', stderr: '' });
    });

    it('reports a clean failure when the daemon is not reachable', async () => {
      const command = new QueueCommand(
        new FakeDaemonClientPort(),
        new FakeDaemonProcessLauncher(),
        'origin/develop',
      );

      const result = await command.run(['stop']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Failed to stop the daemon');
    });
  });

  describe('status', () => {
    it('reports the pid and rounded-down uptime when running', async () => {
      const command = new QueueCommand(
        new FakeDaemonClientPort(PING_OK),
        new FakeDaemonProcessLauncher(),
        'origin/develop',
      );

      const result = await command.run(['status']);

      expect(result).toEqual({
        exitCode: 0,
        stdout: 'Orquestia daemon is running (pid 4242, up 125s).\n',
        stderr: '',
      });
    });

    it('reports not running when unreachable', async () => {
      const command = new QueueCommand(
        new FakeDaemonClientPort(),
        new FakeDaemonProcessLauncher(),
        'origin/develop',
      );

      const result = await command.run(['status']);

      expect(result).toEqual({
        exitCode: 1,
        stdout: '',
        stderr: 'Orquestia daemon is not running.\n',
      });
    });
  });

  describe('submit', () => {
    it('submits with the default baseRef when none is given', async () => {
      const client = new FakeDaemonClientPort(
        new Map([
          ['queue.submit', { taskId: 'ORQ-37', baseRef: 'origin/develop', state: 'running' }],
        ]),
      );
      const command = new QueueCommand(client, new FakeDaemonProcessLauncher(), 'origin/develop');

      const result = await command.run(['submit', 'ORQ-37']);

      expect(result).toEqual({
        exitCode: 0,
        stdout: '  [running] ORQ-37 (origin/develop)\n',
        stderr: '',
      });
      expect(client.calls[0]).toEqual({
        method: 'queue.submit',
        params: { taskId: 'ORQ-37', baseRef: 'origin/develop' },
      });
    });

    it('submits with an explicit baseRef override', async () => {
      const client = new FakeDaemonClientPort(
        new Map([['queue.submit', { taskId: 'ORQ-37', baseRef: 'origin/main', state: 'queued' }]]),
      );
      const command = new QueueCommand(client, new FakeDaemonProcessLauncher(), 'origin/develop');

      await command.run(['submit', 'ORQ-37', 'origin/main']);

      expect(client.calls[0]?.params).toEqual({ taskId: 'ORQ-37', baseRef: 'origin/main' });
    });

    it('rejects a missing taskId', async () => {
      const command = new QueueCommand(
        new FakeDaemonClientPort(),
        new FakeDaemonProcessLauncher(),
        'origin/develop',
      );

      const result = await command.run(['submit']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Usage: orquestia queue submit');
    });

    it('reports a clean failure when the daemon rejects the submission', async () => {
      const command = new QueueCommand(
        new FakeDaemonClientPort(),
        new FakeDaemonProcessLauncher(),
        'origin/develop',
      );

      const result = await command.run(['submit', 'ORQ-37']);

      expect(result.exitCode).toBe(1);
    });

    it('stringifies a non-Error throw from the daemon', async () => {
      const client: DaemonClientPort = {
        call: async () => {
          throw 'raw failure';
        },
      };
      const command = new QueueCommand(client, new FakeDaemonProcessLauncher(), 'origin/develop');

      const result = await command.run(['submit', 'ORQ-37']);

      expect(result).toEqual({ exitCode: 1, stdout: '', stderr: 'raw failure\n' });
    });
  });

  describe('list', () => {
    it('lists running then queued entries', async () => {
      const client = new FakeDaemonClientPort(
        new Map([
          [
            'queue.list',
            {
              running: [{ taskId: 'task-1', baseRef: 'origin/develop', state: 'running' }],
              queued: [{ taskId: 'task-2', baseRef: 'origin/develop', state: 'queued' }],
            },
          ],
        ]),
      );
      const command = new QueueCommand(client, new FakeDaemonProcessLauncher(), 'origin/develop');

      const result = await command.run(['list']);

      expect(result.stdout).toBe(
        '  [running] task-1 (origin/develop)\n  [queued] task-2 (origin/develop)\n',
      );
    });

    it('reports an empty queue', async () => {
      const client = new FakeDaemonClientPort(
        new Map([['queue.list', { running: [], queued: [] }]]),
      );
      const command = new QueueCommand(client, new FakeDaemonProcessLauncher(), 'origin/develop');

      const result = await command.run(['list']);

      expect(result).toEqual({ exitCode: 0, stdout: 'Queue is empty.\n', stderr: '' });
    });

    it('reports a clean failure when the daemon is unreachable', async () => {
      const command = new QueueCommand(
        new FakeDaemonClientPort(),
        new FakeDaemonProcessLauncher(),
        'origin/develop',
      );

      const result = await command.run(['list']);

      expect(result.exitCode).toBe(1);
    });
  });

  describe('cancel', () => {
    it('cancels a task by id', async () => {
      const client = new FakeDaemonClientPort(
        new Map([
          ['queue.cancel', { taskId: 'ORQ-37', baseRef: 'origin/develop', state: 'cancelled' }],
        ]),
      );
      const command = new QueueCommand(client, new FakeDaemonProcessLauncher(), 'origin/develop');

      const result = await command.run(['cancel', 'ORQ-37']);

      expect(result).toEqual({
        exitCode: 0,
        stdout: '  [cancelled] ORQ-37 (origin/develop)\n',
        stderr: '',
      });
    });

    it('rejects a missing taskId', async () => {
      const command = new QueueCommand(
        new FakeDaemonClientPort(),
        new FakeDaemonProcessLauncher(),
        'origin/develop',
      );

      const result = await command.run(['cancel']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Usage: orquestia queue cancel');
    });

    it('reports a clean failure when the daemon rejects the cancellation', async () => {
      const command = new QueueCommand(
        new FakeDaemonClientPort(),
        new FakeDaemonProcessLauncher(),
        'origin/develop',
      );

      const result = await command.run(['cancel', 'missing']);

      expect(result.exitCode).toBe(1);
    });
  });
});
