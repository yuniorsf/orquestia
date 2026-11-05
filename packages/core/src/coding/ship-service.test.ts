import { describe, expect, it } from 'vitest';
import { FakeJiraStatusSyncPort } from '../planning/test-builders.js';
import { ShipService } from './ship-service.js';
import { FakeCommandRunnerPort } from './test-builders.js';
import type { CodingOracleResult, ShipSpec } from './types.js';
import { UnverifiedCodeError } from './types.js';

const ok = { exitCode: 0, stdout: '', stderr: '' };

const passedOracle: CodingOracleResult = { passed: true, exitCode: 0, failedStage: null, runs: [] };
const failedOracle: CodingOracleResult = {
  passed: false,
  exitCode: 30,
  failedStage: 'testRun',
  runs: [],
};

const spec: ShipSpec = {
  worktree: { taskId: 'ORQ-17', path: '/worktrees/ORQ-17', branch: 'orq-17' },
  commitMessage: 'feat(coding): ship (ORQ-17)',
  baseBranch: 'develop',
  prTitle: 'ORQ-17: Coding DAG — Rebase, Re-verification & Ship',
  prBody: 'Implements Phase 5.',
  issueKey: 'ORQ-17',
  jiraTargetStatus: 'In Review',
};

const commitCommand = `git commit -m "${spec.commitMessage}"`;
const pushCommand = `git push -u origin ${spec.worktree.branch}`;
const prCommand = `gh pr create --base ${spec.baseBranch} --title "${spec.prTitle}" --body "${spec.prBody}"`;

describe('ShipService.ship', () => {
  it('refuses to ship when the oracle has not passed', async () => {
    const commandRunner = new FakeCommandRunnerPort({});
    const jiraStatusSync = new FakeJiraStatusSyncPort();
    const service = new ShipService(commandRunner, jiraStatusSync);

    await expect(service.ship('ORQ-17', failedOracle, spec)).rejects.toThrow(UnverifiedCodeError);
    expect(commandRunner.calls).toEqual([]);
  });

  it('fails at the stage step without attempting to commit', async () => {
    const commandRunner = new FakeCommandRunnerPort({
      'git add -A': { exitCode: 1, stdout: '', stderr: 'index lock held' },
    });
    const service = new ShipService(commandRunner, new FakeJiraStatusSyncPort());

    const result = await service.ship('ORQ-17', passedOracle, spec);

    expect(result).toEqual({ status: 'failed', failedStep: 'stage', reason: 'index lock held' });
    expect(commandRunner.calls).toEqual(['git add -A']);
  });

  it('falls back to stdout as the reason when a failure has empty stderr', async () => {
    const commandRunner = new FakeCommandRunnerPort({
      'git add -A': { exitCode: 1, stdout: 'fatal: not a git repository', stderr: '' },
    });
    const service = new ShipService(commandRunner, new FakeJiraStatusSyncPort());

    const result = await service.ship('ORQ-17', passedOracle, spec);

    expect(result).toEqual({
      status: 'failed',
      failedStep: 'stage',
      reason: 'fatal: not a git repository',
    });
  });

  it('fails at the commit step without attempting to push', async () => {
    const commandRunner = new FakeCommandRunnerPort({
      'git add -A': ok,
      [commitCommand]: { exitCode: 1, stdout: '', stderr: 'nothing to commit' },
    });
    const service = new ShipService(commandRunner, new FakeJiraStatusSyncPort());

    const result = await service.ship('ORQ-17', passedOracle, spec);

    expect(result).toEqual({ status: 'failed', failedStep: 'commit', reason: 'nothing to commit' });
    expect(commandRunner.calls).toEqual(['git add -A', commitCommand]);
  });

  it('fails at the push step without creating a pull request', async () => {
    const commandRunner = new FakeCommandRunnerPort({
      'git add -A': ok,
      [commitCommand]: ok,
      [pushCommand]: { exitCode: 1, stdout: '', stderr: 'remote rejected' },
    });
    const service = new ShipService(commandRunner, new FakeJiraStatusSyncPort());

    const result = await service.ship('ORQ-17', passedOracle, spec);

    expect(result).toEqual({ status: 'failed', failedStep: 'push', reason: 'remote rejected' });
  });

  it('fails at the PR step and does not transition Jira', async () => {
    const commandRunner = new FakeCommandRunnerPort({
      'git add -A': ok,
      [commitCommand]: ok,
      [pushCommand]: ok,
      [prCommand]: { exitCode: 1, stdout: '', stderr: 'gh: not authenticated' },
    });
    const jiraStatusSync = new FakeJiraStatusSyncPort();
    const service = new ShipService(commandRunner, jiraStatusSync);

    const result = await service.ship('ORQ-17', passedOracle, spec);

    expect(result).toEqual({
      status: 'failed',
      failedStep: 'createPullRequest',
      reason: 'gh: not authenticated',
    });
    expect(jiraStatusSync.transitions).toEqual([]);
  });

  it('ships end-to-end and transitions the linked Jira issue', async () => {
    const commandRunner = new FakeCommandRunnerPort({
      'git add -A': ok,
      [commitCommand]: ok,
      [pushCommand]: ok,
      [prCommand]: {
        exitCode: 0,
        stdout: 'Creating PR...\nhttps://github.com/org/repo/pull/42\n',
        stderr: '',
      },
    });
    const jiraStatusSync = new FakeJiraStatusSyncPort();
    const service = new ShipService(commandRunner, jiraStatusSync);

    const result = await service.ship('ORQ-17', passedOracle, spec);

    expect(result).toEqual({
      status: 'shipped',
      pullRequestUrl: 'https://github.com/org/repo/pull/42',
    });
    expect(jiraStatusSync.transitions).toEqual([{ issueKey: 'ORQ-17', statusName: 'In Review' }]);
  });

  it('ships without transitioning Jira when no issue is linked', async () => {
    const commandRunner = new FakeCommandRunnerPort({
      'git add -A': ok,
      [commitCommand]: ok,
      [pushCommand]: ok,
      [prCommand]: { exitCode: 0, stdout: 'https://github.com/org/repo/pull/42', stderr: '' },
    });
    const jiraStatusSync = new FakeJiraStatusSyncPort();
    const service = new ShipService(commandRunner, jiraStatusSync);

    const result = await service.ship('ORQ-17', passedOracle, { ...spec, issueKey: null });

    expect(result).toEqual({
      status: 'shipped',
      pullRequestUrl: 'https://github.com/org/repo/pull/42',
    });
    expect(jiraStatusSync.transitions).toEqual([]);
  });

  it('returns an empty pull request URL when gh prints no output', async () => {
    const commandRunner = new FakeCommandRunnerPort({
      'git add -A': ok,
      [commitCommand]: ok,
      [pushCommand]: ok,
      [prCommand]: { exitCode: 0, stdout: '', stderr: '' },
    });
    const service = new ShipService(commandRunner, new FakeJiraStatusSyncPort());

    const result = await service.ship('ORQ-17', passedOracle, { ...spec, issueKey: null });

    expect(result).toEqual({ status: 'shipped', pullRequestUrl: '' });
  });
});
