import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { CheckpointHandle, CheckpointPort } from './types.js';

const execFileAsync = promisify(execFile);

/**
 * Snapshots the worktree via `git stash create` (which captures a checkpoint
 * commit without touching the working tree, so the agent's edits stay in
 * place) and rolls back via `git checkout <commit> -- .` on regression
 * ($f^{op}$).
 *
 * Rollback deliberately avoids `git reset --hard`: the worktree stays
 * checked out on the task branch (not detached) for the whole coding run,
 * so `reset --hard <stash-create-sha>` would move the branch ref itself to
 * that stash commit — a 2-parent merge commit (git's standard stash shape).
 * That silently corrupts any later `git rebase` onto the base branch, which
 * drops merge commits from its replay by default and discards whatever
 * tracked-file content only existed via the merge's non-first parent (e.g.
 * a legitimate MODIFY from the original synthesis). `git checkout <commit>
 * -- .` restores the same tracked-file content without ever touching HEAD.
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
    await execFileAsync('git', ['checkout', handle.id, '--', '.'], { cwd: this.cwd });
  }
}
