import type { CommandRunnerPort } from '../coding/types.js';
import type { WorktreeDiffPort, WorktreeDiffSummary, WorktreeFileDiff } from './types.js';

function parseCount(raw: string | undefined): number {
  const value = Number(raw);
  if (Number.isNaN(value)) {
    return 0;
  }
  return value;
}

function parseNumstatLine(line: string): WorktreeFileDiff {
  const [insertions, deletions, path] = line.split('\t');
  return {
    path: path ?? '',
    insertions: parseCount(insertions),
    deletions: parseCount(deletions),
  };
}

/**
 * Real `WorktreeDiffPort` adapter backing live diff previews: runs
 * `git diff --numstat` (uncommitted changes against `HEAD`) inside the
 * worktree via the injected {@link CommandRunnerPort}, so it reuses the
 * exact same shell-execution path already exercised by the Coding DAG
 * Oracle rather than introducing a second process-spawning mechanism.
 */
export class GitWorktreeDiffPort implements WorktreeDiffPort {
  constructor(private readonly commandRunner: CommandRunnerPort) {}

  async summarize(worktreePath: string): Promise<WorktreeDiffSummary> {
    const result = await this.commandRunner.run('git diff --numstat HEAD');
    const files = result.stdout
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map(parseNumstatLine);

    return { worktreePath, files };
  }
}
