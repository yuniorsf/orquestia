import type { CodingOracleRunner } from './coding-oracle-runner.js';
import type {
  CommandResult,
  CommandRunnerPort,
  OracleCommands,
  RebaseAndVerifyResult,
} from './types.js';

/**
 * Coding DAG Phase 5 (rebase step): fetches and rebases the worktree onto
 * `baseRef`, then mandatorily re-runs the Phase 3 oracle — a pre-rebase
 * green is never trusted, since the rebase can introduce conflicts or
 * integration breakage the pre-rebase run couldn't see. Mechanical and
 * semantic conflicts are both reported (not auto-resolved here); on any
 * conflict the rebase is aborted so the worktree is left clean.
 */
export class RebaseAndReverifyService {
  constructor(
    private readonly commandRunner: CommandRunnerPort,
    private readonly oracleRunner: CodingOracleRunner,
  ) {}

  async run(baseRef: string, oracleCommands: OracleCommands): Promise<RebaseAndVerifyResult> {
    const fetchResult = await this.commandRunner.run('git fetch origin');
    if (fetchResult.exitCode !== 0) {
      return {
        rebase: { status: 'failed', reason: reasonFrom(fetchResult) },
        oracle: null,
      };
    }

    const rebaseResult = await this.commandRunner.run(`git rebase ${baseRef}`);
    if (rebaseResult.exitCode !== 0) {
      const conflicts = await this.commandRunner.run('git diff --name-only --diff-filter=U');
      const conflictingFiles = conflicts.stdout
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      await this.commandRunner.run('git rebase --abort');

      if (conflictingFiles.length > 0) {
        return { rebase: { status: 'conflict', conflictingFiles }, oracle: null };
      }
      return {
        rebase: { status: 'failed', reason: reasonFrom(rebaseResult) },
        oracle: null,
      };
    }

    const oracle = await this.oracleRunner.run(oracleCommands);
    return { rebase: { status: 'clean' }, oracle };
  }
}

function reasonFrom(result: CommandResult): string {
  return result.stderr || result.stdout;
}
