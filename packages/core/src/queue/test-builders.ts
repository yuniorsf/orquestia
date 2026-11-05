import type { WorktreeHandle, WorktreeProvisioner } from './types.js';

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
