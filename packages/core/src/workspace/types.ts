export interface WorktreeHandle {
  readonly taskId: string;
  readonly path: string;
  readonly branch: string;
}

export interface WorktreeProvisioner {
  create(taskId: string, baseRef: string): Promise<WorktreeHandle>;
  destroy(taskId: string): Promise<void>;
}

export interface CheckpointHandle {
  readonly id: string;
}

export interface CheckpointPort {
  create(): Promise<CheckpointHandle>;
  rollback(handle: CheckpointHandle): Promise<void>;
}

export interface WorktreePoolConfig {
  readonly maxConcurrentWorktrees: number;
}

export class InvalidWorktreePoolConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidWorktreePoolConfigError';
  }
}

export class DuplicateWorktreeSlotError extends Error {
  constructor(taskId: string) {
    super(`Worktree slot for task "${taskId}" is already acquired.`);
    this.name = 'DuplicateWorktreeSlotError';
  }
}

export class WorktreePoolExhaustedError extends Error {
  constructor(taskId: string, maxConcurrentWorktrees: number) {
    super(
      `Cannot acquire a worktree slot for task "${taskId}": pool is at capacity (${maxConcurrentWorktrees}).`,
    );
    this.name = 'WorktreePoolExhaustedError';
  }
}

export class UnknownWorktreeSlotError extends Error {
  constructor(taskId: string) {
    super(`No acquired worktree slot for task "${taskId}".`);
    this.name = 'UnknownWorktreeSlotError';
  }
}
