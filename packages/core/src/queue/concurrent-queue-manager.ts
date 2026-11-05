import {
  DuplicateTaskError,
  InvalidQueueConfigError,
  InvalidQueueTransitionError,
  UnknownQueueEntryError,
  type QueueConfig,
  type QueueEntry,
  type WorktreeProvisioner,
} from './types.js';

interface MutableEntry {
  taskId: string;
  baseRef: string;
  state: QueueEntry['state'];
  handle: QueueEntry['handle'];
}

/**
 * Orchestrates isolated Git worktrees under a configurable concurrency cap
 * (`runtime.concurrency.max_parallel_tasks`), queueing overflow tasks FIFO
 * and promoting the next queued task whenever a running slot frees up.
 */
export class ConcurrentQueueManager {
  private readonly entries: MutableEntry[] = [];

  constructor(
    private readonly provisioner: WorktreeProvisioner,
    private readonly config: QueueConfig,
  ) {
    if (config.maxParallelTasks < 1) {
      throw new InvalidQueueConfigError('maxParallelTasks must be at least 1.');
    }
  }

  async enqueue(taskId: string, baseRef: string): Promise<QueueEntry> {
    if (this.findEntry(taskId)) {
      throw new DuplicateTaskError(taskId);
    }

    const entry: MutableEntry = { taskId, baseRef, state: 'queued', handle: null };
    this.entries.push(entry);

    if (this.runningCount() < this.config.maxParallelTasks) {
      await this.start(entry);
    }

    return snapshot(entry);
  }

  async complete(taskId: string): Promise<QueueEntry> {
    const entry = this.requireRunning(taskId, 'complete');

    if (this.config.autoCleanupOnMerge) {
      await this.provisioner.destroy(taskId);
    }
    entry.state = 'completed';

    await this.promoteNext();
    return snapshot(entry);
  }

  async fail(taskId: string): Promise<QueueEntry> {
    const entry = this.requireRunning(taskId, 'fail');

    entry.state = 'failed';

    await this.promoteNext();
    return snapshot(entry);
  }

  get(taskId: string): QueueEntry | undefined {
    const entry = this.findEntry(taskId);
    return entry ? snapshot(entry) : undefined;
  }

  listRunning(): readonly QueueEntry[] {
    return this.entries.filter((entry) => entry.state === 'running').map(snapshot);
  }

  listQueued(): readonly QueueEntry[] {
    return this.entries.filter((entry) => entry.state === 'queued').map(snapshot);
  }

  private findEntry(taskId: string): MutableEntry | undefined {
    return this.entries.find((entry) => entry.taskId === taskId);
  }

  private runningCount(): number {
    return this.entries.filter((entry) => entry.state === 'running').length;
  }

  private async start(entry: MutableEntry): Promise<void> {
    const handle = await this.provisioner.create(entry.taskId, entry.baseRef);
    entry.state = 'running';
    entry.handle = handle;
  }

  private requireRunning(taskId: string, action: string): MutableEntry {
    const entry = this.findEntry(taskId);
    if (!entry) {
      throw new UnknownQueueEntryError(taskId);
    }
    if (entry.state !== 'running') {
      throw new InvalidQueueTransitionError(taskId, entry.state, action);
    }
    return entry;
  }

  private async promoteNext(): Promise<void> {
    const next = this.entries.find((entry) => entry.state === 'queued');
    if (next) {
      await this.start(next);
    }
  }
}

function snapshot(entry: MutableEntry): QueueEntry {
  return { taskId: entry.taskId, baseRef: entry.baseRef, state: entry.state, handle: entry.handle };
}
