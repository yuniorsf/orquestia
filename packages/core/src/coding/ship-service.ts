import type { JiraStatusSyncPort } from '../planning/types.js';
import {
  UnverifiedCodeError,
  type CodingOracleResult,
  type CommandResult,
  type CommandRunnerPort,
  type ShipOutcome,
  type ShipSpec,
} from './types.js';

/**
 * Coding DAG Phase 5 (ship step): on `--ship`, commits the verified worktree
 * with a conventional + Jira-key message, pushes, opens the GitHub PR via
 * `gh pr create`, and transitions the linked Jira issue. Refuses to run at
 * all unless the Phase 3 oracle passed — mirrors
 * {@link import('../planning/plan-synthesis-service.js').PlanSynthesisService}'s
 * `UnverifiedPlanError` guard for the coding side of the pipeline.
 */
export class ShipService {
  constructor(
    private readonly commandRunner: CommandRunnerPort,
    private readonly jiraStatusSync: JiraStatusSyncPort,
  ) {}

  async ship(
    taskId: string,
    oracleResult: CodingOracleResult,
    spec: ShipSpec,
  ): Promise<ShipOutcome> {
    if (!oracleResult.passed) {
      throw new UnverifiedCodeError(taskId);
    }

    const stageResult = await this.commandRunner.run('git add -A');
    if (stageResult.exitCode !== 0) {
      return { status: 'failed', failedStep: 'stage', reason: reasonFrom(stageResult) };
    }

    const commitResult = await this.commandRunner.run(`git commit -m "${spec.commitMessage}"`);
    if (commitResult.exitCode !== 0) {
      return { status: 'failed', failedStep: 'commit', reason: reasonFrom(commitResult) };
    }

    const pushResult = await this.commandRunner.run(`git push -u origin ${spec.worktree.branch}`);
    if (pushResult.exitCode !== 0) {
      return { status: 'failed', failedStep: 'push', reason: reasonFrom(pushResult) };
    }

    const prResult = await this.commandRunner.run(
      `gh pr create --base ${spec.baseBranch} --title "${spec.prTitle}" --body "${spec.prBody}"`,
    );
    if (prResult.exitCode !== 0) {
      return { status: 'failed', failedStep: 'createPullRequest', reason: reasonFrom(prResult) };
    }

    if (spec.issueKey) {
      await this.jiraStatusSync.transitionIssue(spec.issueKey, spec.jiraTargetStatus);
    }

    return { status: 'shipped', pullRequestUrl: extractPullRequestUrl(prResult.stdout) };
  }
}

function reasonFrom(result: CommandResult): string {
  return result.stderr || result.stdout;
}

function extractPullRequestUrl(stdout: string): string {
  const lines = stdout
    .trim()
    .split('\n')
    .filter((line) => line.length > 0);
  return lines.length > 0 ? lines[lines.length - 1]! : '';
}
