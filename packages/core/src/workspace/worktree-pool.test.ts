import { describe, expect, it } from 'vitest';
import { WorktreePool } from './worktree-pool.js';
import { FakeWorktreeProvisioner } from './test-builders.js';
import {
  DuplicateWorktreeSlotError,
  InvalidWorktreePoolConfigError,
  UnknownWorktreeSlotError,
  WorktreePoolExhaustedError,
} from './types.js';

function createPool(maxConcurrentWorktrees = 2) {
  const provisioner = new FakeWorktreeProvisioner();
  const pool = new WorktreePool(provisioner, { maxConcurrentWorktrees });
  return { pool, provisioner };
}

describe('WorktreePool constructor', () => {
  it('rejects a non-positive maxConcurrentWorktrees', () => {
    const provisioner = new FakeWorktreeProvisioner();

    expect(() => new WorktreePool(provisioner, { maxConcurrentWorktrees: 0 })).toThrow(
      InvalidWorktreePoolConfigError,
    );
  });
});

describe('WorktreePool.acquire', () => {
  it('provisions a worktree and tracks it as active when under capacity', async () => {
    const { pool, provisioner } = createPool(2);

    const handle = await pool.acquire('task-1', 'origin/develop');

    expect(handle).toEqual({ taskId: 'task-1', path: '/worktrees/task-1', branch: 'task-1' });
    expect(provisioner.createCalls).toEqual([{ taskId: 'task-1', baseRef: 'origin/develop' }]);
    expect(pool.listActive()).toEqual([handle]);
  });

  it('rejects acquiring a slot for a task ID that is already active', async () => {
    const { pool } = createPool(2);
    await pool.acquire('task-1', 'origin/develop');

    await expect(pool.acquire('task-1', 'origin/develop')).rejects.toThrow(
      DuplicateWorktreeSlotError,
    );
  });

  it('rejects acquiring a slot beyond the configured capacity', async () => {
    const { pool, provisioner } = createPool(1);
    await pool.acquire('task-1', 'origin/develop');

    await expect(pool.acquire('task-2', 'origin/develop')).rejects.toThrow(
      WorktreePoolExhaustedError,
    );
    expect(provisioner.createCalls).toEqual([{ taskId: 'task-1', baseRef: 'origin/develop' }]);
  });
});

describe('WorktreePool.release', () => {
  it('destroys the worktree and frees its slot', async () => {
    const { pool, provisioner } = createPool(1);
    await pool.acquire('task-1', 'origin/develop');

    await pool.release('task-1');

    expect(provisioner.destroyCalls).toEqual(['task-1']);
    expect(pool.listActive()).toEqual([]);
  });

  it('allows a new acquire to reuse the freed slot', async () => {
    const { pool } = createPool(1);
    await pool.acquire('task-1', 'origin/develop');
    await pool.release('task-1');

    const handle = await pool.acquire('task-2', 'origin/develop');

    expect(handle.taskId).toBe('task-2');
    expect(pool.listActive()).toEqual([handle]);
  });

  it('rejects releasing a task ID with no active slot', async () => {
    const { pool } = createPool(1);

    await expect(pool.release('missing')).rejects.toThrow(UnknownWorktreeSlotError);
  });
});

describe('WorktreePool.listActive', () => {
  it('returns an empty list when nothing is acquired', () => {
    const { pool } = createPool();

    expect(pool.listActive()).toEqual([]);
  });

  it('lists every currently acquired handle', async () => {
    const { pool } = createPool(2);
    const handleA = await pool.acquire('task-a', 'origin/develop');
    const handleB = await pool.acquire('task-b', 'origin/develop');

    expect(pool.listActive()).toEqual([handleA, handleB]);
  });
});
