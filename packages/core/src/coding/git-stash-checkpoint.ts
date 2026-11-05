import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { CheckpointHandle, CheckpointPort } from './types.js';

const execFileAsync = promisify(execFile);

/**
 * Snapshots the worktree via `git stash create` (which captures a checkpoint
 * commit without touching the working tree, so the agent's edits stay in
 * place) and rolls back via `git reset --hard` on regression ($f^{op}$).
 */
export class GitStashCheckpoint implements CheckpointPort {
  constructor(private readonly cwd: string) {}

  async create(): Promise<CheckpointHandle> {
    const { stdout } = await execFileAsync('git', ['stash', 'create'], { cwd: this.cwd });
    return { id: stdout.trim() };
  }

  async rollback(handle: CheckpointHandle): Promise<void> {
    if (!handle.id) {
      // `git stash create` returns an empty string when the tree was already
      // clean — there is nothing to roll back to.
      return;
    }
    await execFileAsync('git', ['reset', '--hard', handle.id], { cwd: this.cwd });
  }
}
