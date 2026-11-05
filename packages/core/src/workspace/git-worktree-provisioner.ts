import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { WorktreeHandle, WorktreeProvisioner } from './types.js';

const execFileAsync = promisify(execFile);

/**
 * Provisions the physical `../worktrees/<taskId>` sandboxes backing the
 * Workspace Engine, via plain `git worktree add|remove` (the same primitive
 * `scripts/agent-sandbox.sh` wraps for interactive/CLI use).
 */
export class GitWorktreeProvisioner implements WorktreeProvisioner {
  constructor(
    private readonly repoRoot: string,
    private readonly worktreesRoot: string,
  ) {}

  async create(taskId: string, baseRef: string): Promise<WorktreeHandle> {
    const branch = taskId.toLowerCase();
    const path = join(this.worktreesRoot, taskId);
    await execFileAsync('git', ['worktree', 'add', '-b', branch, path, baseRef], {
      cwd: this.repoRoot,
    });
    return { taskId, path, branch };
  }

  async destroy(taskId: string): Promise<void> {
    const path = join(this.worktreesRoot, taskId);
    await execFileAsync('git', ['worktree', 'remove', '--force', path], {
      cwd: this.repoRoot,
    });
  }
}
