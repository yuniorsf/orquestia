export interface WorktreeHandle {
  readonly taskId: string;
  readonly path: string;
  readonly branch: string;
}

export interface WorktreeProvisioner {
  create(taskId: string, baseRef: string): Promise<WorktreeHandle>;
  destroy(taskId: string): Promise<void>;
}

export interface QueueConfig {
  readonly maxParallelTasks: number;
  readonly autoCleanupOnMerge: boolean;
}

export type QueuedTaskState = 'queued' | 'running' | 'completed' | 'failed';

export interface QueueEntry {
  readonly taskId: string;
  readonly baseRef: string;
  readonly state: QueuedTaskState;
  readonly handle: WorktreeHandle | null;
}

export class InvalidQueueConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidQueueConfigError';
  }
}

export class DuplicateTaskError extends Error {
  constructor(taskId: string) {
    super(`Task "${taskId}" is already queued or running.`);
    this.name = 'DuplicateTaskError';
  }
}

export class UnknownQueueEntryError extends Error {
  constructor(taskId: string) {
    super(`No queue entry for task "${taskId}".`);
    this.name = 'UnknownQueueEntryError';
  }
}

export class InvalidQueueTransitionError extends Error {
  constructor(taskId: string, from: QueuedTaskState, action: string) {
    super(`Cannot ${action} task "${taskId}" while it is "${from}".`);
    this.name = 'InvalidQueueTransitionError';
  }
}
