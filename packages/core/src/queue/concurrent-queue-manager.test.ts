import { describe, expect, it } from 'vitest';
import { FakeWorktreeProvisioner } from '../workspace/test-builders.js';
import { ConcurrentQueueManager } from './concurrent-queue-manager.js';
import {
  DuplicateTaskError,
  InvalidQueueConfigError,
  InvalidQueueTransitionError,
  UnknownQueueEntryError,
} from './types.js';

function createManager(maxParallelTasks = 1, autoCleanupOnMerge = true) {
  const provisioner = new FakeWorktreeProvisioner();
  const manager = new ConcurrentQueueManager(provisioner, { maxParallelTasks, autoCleanupOnMerge });
  return { manager, provisioner };
}

describe('ConcurrentQueueManager constructor', () => {
  it('rejects a non-positive maxParallelTasks', () => {
    const provisioner = new FakeWorktreeProvisioner();

    expect(
      () =>
        new ConcurrentQueueManager(provisioner, { maxParallelTasks: 0, autoCleanupOnMerge: true }),
    ).toThrow(InvalidQueueConfigError);
  });
});

describe('ConcurrentQueueManager.enqueue', () => {
  it('immediately provisions a worktree when under capacity', async () => {
    const { manager, provisioner } = createManager(2);

    const entry = await manager.enqueue('task-1', 'origin/develop');

    expect(entry.state).toBe('running');
    expect(entry.handle).toEqual({ taskId: 'task-1', path: '/worktrees/task-1', branch: 'task-1' });
    expect(provisioner.createCalls).toEqual([{ taskId: 'task-1', baseRef: 'origin/develop' }]);
  });

  it('queues overflow tasks without provisioning a worktree', async () => {
    const { manager, provisioner } = createManager(1);
    await manager.enqueue('task-1', 'origin/develop');

    const entry = await manager.enqueue('task-2', 'origin/develop');

    expect(entry.state).toBe('queued');
    expect(entry.handle).toBeNull();
    expect(provisioner.createCalls).toEqual([{ taskId: 'task-1', baseRef: 'origin/develop' }]);
  });

  it('rejects enqueueing a task ID that is already queued or running', async () => {
    const { manager } = createManager(1);
    await manager.enqueue('task-1', 'origin/develop');

    await expect(manager.enqueue('task-1', 'origin/develop')).rejects.toThrow(DuplicateTaskError);
  });
});

describe('ConcurrentQueueManager.complete', () => {
  it('throws UnknownQueueEntryError for a task that was never enqueued', async () => {
    const { manager } = createManager();

    await expect(manager.complete('missing')).rejects.toThrow(UnknownQueueEntryError);
  });

  it('throws InvalidQueueTransitionError when completing a non-running task', async () => {
    const { manager } = createManager(1);
    await manager.enqueue('task-1', 'origin/develop');
    await manager.enqueue('task-2', 'origin/develop'); // stays queued, capacity 1

    await expect(manager.complete('task-2')).rejects.toThrow(InvalidQueueTransitionError);
  });

  it('destroys the worktree on completion when autoCleanupOnMerge is true', async () => {
    const { manager, provisioner } = createManager(1, true);
    await manager.enqueue('task-1', 'origin/develop');

    const entry = await manager.complete('task-1');

    expect(entry.state).toBe('completed');
    expect(provisioner.destroyCalls).toEqual(['task-1']);
  });

  it('leaves the worktree intact on completion when autoCleanupOnMerge is false', async () => {
    const { manager, provisioner } = createManager(1, false);
    await manager.enqueue('task-1', 'origin/develop');

    await manager.complete('task-1');

    expect(provisioner.destroyCalls).toEqual([]);
  });

  it('promotes the next queued task once a running slot frees up', async () => {
    const { manager, provisioner } = createManager(1);
    await manager.enqueue('task-1', 'origin/develop');
    await manager.enqueue('task-2', 'origin/develop');

    await manager.complete('task-1');

    expect(manager.get('task-2')?.state).toBe('running');
    expect(provisioner.createCalls.map((call) => call.taskId)).toEqual(['task-1', 'task-2']);
  });

  it('does nothing extra when completing with no queued tasks waiting', async () => {
    const { manager, provisioner } = createManager(1);
    await manager.enqueue('task-1', 'origin/develop');

    await manager.complete('task-1');

    expect(provisioner.createCalls).toHaveLength(1);
  });
});

describe('ConcurrentQueueManager.fail', () => {
  it('throws UnknownQueueEntryError for a task that was never enqueued', async () => {
    const { manager } = createManager();

    await expect(manager.fail('missing')).rejects.toThrow(UnknownQueueEntryError);
  });

  it('marks the task failed without destroying its worktree', async () => {
    const { manager, provisioner } = createManager(1, true);
    await manager.enqueue('task-1', 'origin/develop');

    const entry = await manager.fail('task-1');

    expect(entry.state).toBe('failed');
    expect(provisioner.destroyCalls).toEqual([]);
  });

  it('promotes the next queued task after a failure', async () => {
    const { manager } = createManager(1);
    await manager.enqueue('task-1', 'origin/develop');
    await manager.enqueue('task-2', 'origin/develop');

    await manager.fail('task-1');

    expect(manager.get('task-2')?.state).toBe('running');
  });
});

describe('ConcurrentQueueManager read accessors', () => {
  it('get() returns undefined for an unknown task', () => {
    const { manager } = createManager();

    expect(manager.get('missing')).toBeUndefined();
  });

  it('lists running and queued tasks separately', async () => {
    const { manager } = createManager(1);
    await manager.enqueue('task-1', 'origin/develop');
    await manager.enqueue('task-2', 'origin/develop');

    expect(manager.listRunning().map((entry) => entry.taskId)).toEqual(['task-1']);
    expect(manager.listQueued().map((entry) => entry.taskId)).toEqual(['task-2']);
  });

  it('returns empty lists when the queue is empty', () => {
    const { manager } = createManager();

    expect(manager.listRunning()).toEqual([]);
    expect(manager.listQueued()).toEqual([]);
  });
});
