import type {
  CheckpointHandle,
  CheckpointPort,
  WorktreeHandle,
  WorktreeProvisioner,
} from './types.js';

export class FakeWorktreeProvisioner implements WorktreeProvisioner {
  readonly createCalls: Array<{ taskId: string; baseRef: string }> = [];
  readonly destroyCalls: string[] = [];

  async create(taskId: string, baseRef: string): Promise<WorktreeHandle> {
    this.createCalls.push({ taskId, baseRef });
    return { taskId, path: `/worktrees/${taskId}`, branch: taskId.toLowerCase() };
  }

  async destroy(taskId: string): Promise<void> {
    this.destroyCalls.push(taskId);
  }
}

export class FakeCheckpointPort implements CheckpointPort {
  private sequence = 0;
  readonly createdHandles: CheckpointHandle[] = [];
  readonly rolledBackHandles: CheckpointHandle[] = [];

  async create(): Promise<CheckpointHandle> {
    this.sequence += 1;
    const handle = { id: `checkpoint-${this.sequence}` };
    this.createdHandles.push(handle);
    return handle;
  }

  async rollback(handle: CheckpointHandle): Promise<void> {
    this.rolledBackHandles.push(handle);
  }
}
