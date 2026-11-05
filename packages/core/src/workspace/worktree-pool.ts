import {
  DuplicateWorktreeSlotError,
  InvalidWorktreePoolConfigError,
  UnknownWorktreeSlotError,
  WorktreePoolExhaustedError,
  type WorktreeHandle,
  type WorktreePoolConfig,
  type WorktreeProvisioner,
} from './types.js';

/**
 * Bounds concurrent `../worktrees/<taskId>` sandboxes to
 * `maxConcurrentWorktrees` (`harness.config.json`'s `project.maxConcurrentWorktrees`),
 * independent of any particular DAG's scheduling policy — contrast with the
 * Coding DAG's FIFO `ConcurrentQueueManager`, which is one caller of this pool,
 * not a replacement for it.
 */
export class WorktreePool {
  private readonly active = new Map<string, WorktreeHandle>();

  constructor(
    private readonly provisioner: WorktreeProvisioner,
    private readonly config: WorktreePoolConfig,
  ) {
    if (config.maxConcurrentWorktrees < 1) {
      throw new InvalidWorktreePoolConfigError('maxConcurrentWorktrees must be at least 1.');
    }
  }

  async acquire(taskId: string, baseRef: string): Promise<WorktreeHandle> {
    if (this.active.has(taskId)) {
      throw new DuplicateWorktreeSlotError(taskId);
    }
    if (this.active.size >= this.config.maxConcurrentWorktrees) {
      throw new WorktreePoolExhaustedError(taskId, this.config.maxConcurrentWorktrees);
    }

    const handle = await this.provisioner.create(taskId, baseRef);
    this.active.set(taskId, handle);
    return handle;
  }

  async release(taskId: string): Promise<void> {
    if (!this.active.has(taskId)) {
      throw new UnknownWorktreeSlotError(taskId);
    }
    await this.provisioner.destroy(taskId);
    this.active.delete(taskId);
  }

  listActive(): readonly WorktreeHandle[] {
    return [...this.active.values()];
  }
}
