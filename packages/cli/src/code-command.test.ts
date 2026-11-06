import type { OracleCommands, SpecialistOutput, WorktreeHandle } from '@orquestia/core';
import { describe, expect, it } from 'vitest';
import { CodeCommand } from './code-command.js';
import type { CodeCommandDependencies } from './code-command.js';
import {
  FakeCheckpointPort,
  FakeCliCommandRunnerPort,
  FakeCodeShipService,
  FakeCodeSynthesisDispatcherPort,
  FakeCodingRemediationDispatcherPort,
  FakeSpecialistDispatcherPort,
  FakeWorktreeProvisioner,
} from './test-builders.js';

const EMPTY_BRANCH_A: SpecialistOutput = { branch: '2A', fileManifest: [], codeSnippets: [] };
const EMPTY_BRANCH_B: SpecialistOutput = { branch: '2B', fileManifest: [], codeSnippets: [] };
const WORKTREE: WorktreeHandle = { taskId: 'ORQ-35', path: '/worktrees/ORQ-35', branch: 'orq-35' };
const PASSING_COMMANDS: OracleCommands = {
  solidPreflight: 'solid',
  formatCheck: 'format',
  buildAndLint: 'build',
  testRun: 'test',
};
const OK = { exitCode: 0, stdout: '', stderr: '' };

function buildDeps(overrides?: Partial<CodeCommandDependencies>): CodeCommandDependencies {
  return {
    repoBaseRef: 'origin/develop',
    worktreeProvisioner: new FakeWorktreeProvisioner(() => WORKTREE),
    checkpointFactory: () => new FakeCheckpointPort(),
    commandRunnerFactory: () =>
      new FakeCliCommandRunnerPort({
        [PASSING_COMMANDS.solidPreflight]: OK,
        [PASSING_COMMANDS.formatCheck]: OK,
        [PASSING_COMMANDS.buildAndLint]: OK,
        [PASSING_COMMANDS.testRun]: OK,
        'git fetch origin': OK,
        'git rebase origin/develop': OK,
      }),
    planDispatcherFactory: () =>
      new FakeSpecialistDispatcherPort({ '2A': EMPTY_BRANCH_A, '2B': EMPTY_BRANCH_B }),
    codeSynthesisDispatcherFactory: () => new FakeCodeSynthesisDispatcherPort(),
    remediationDispatcherFactory: () => new FakeCodingRemediationDispatcherPort(),
    oracleCommandsFactory: () => PASSING_COMMANDS,
    shipServiceFactory: () =>
      new FakeCodeShipService({ status: 'shipped', pullRequestUrl: 'https://pr' }),
    maxSelfHealRetries: 3,
    ...overrides,
  };
}

describe('CodeCommand', () => {
  it('rejects a call with no taskId', async () => {
    const command = new CodeCommand(buildDeps());

    const result = await command.run([]);

    expect(result).toEqual({
      exitCode: 1,
      stdout: '',
      stderr: 'Usage: orquestia code <taskId> [--ship]\n',
    });
  });

  it('reports a clean failure instead of crashing when manifest decomposition throws', async () => {
    const provisioner = new FakeWorktreeProvisioner(() => WORKTREE);
    const command = new CodeCommand(
      buildDeps({
        worktreeProvisioner: provisioner,
        planDispatcherFactory: () => ({
          dispatch: async () => {
            throw new Error('agent CLI exited non-zero');
          },
        }),
      }),
    );

    const result = await command.run(['ORQ-35']);

    expect(result).toEqual({
      exitCode: 1,
      stdout: '',
      stderr: 'Manifest decomposition failed for "ORQ-35": agent CLI exited non-zero\n',
    });
    expect(provisioner.created).toHaveLength(0);
  });

  it('stringifies a non-Error throw from manifest decomposition', async () => {
    const command = new CodeCommand(
      buildDeps({
        planDispatcherFactory: () => ({
          dispatch: async () => {
            throw 'raw failure';
          },
        }),
      }),
    );

    const result = await command.run(['ORQ-35']);

    expect(result.stderr).toBe('Manifest decomposition failed for "ORQ-35": raw failure\n');
  });

  it('reports a disjoint allocation error without provisioning a worktree', async () => {
    const provisioner = new FakeWorktreeProvisioner(() => WORKTREE);
    const command = new CodeCommand(
      buildDeps({
        worktreeProvisioner: provisioner,
        planDispatcherFactory: () =>
          new FakeSpecialistDispatcherPort({
            '2A': { branch: '2A', fileManifest: [{ path: 'a.ts', kind: 'NEW' }], codeSnippets: [] },
            '2B': { branch: '2B', fileManifest: [{ path: 'a.ts', kind: 'NEW' }], codeSnippets: [] },
          }),
      }),
    );

    const result = await command.run(['ORQ-35']);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Disjoint file allocation violated');
    expect(provisioner.created).toHaveLength(0);
  });

  it("FakeWorktreeProvisioner.destroy is a no-op (CodeCommand never calls it — cleanup is the orchestration layer's job)", async () => {
    const provisioner = new FakeWorktreeProvisioner(() => WORKTREE);

    await expect(provisioner.destroy()).resolves.toBeUndefined();
  });

  it('FakeCliCommandRunnerPort throws for a command with no configured result', async () => {
    const commandRunner = new FakeCliCommandRunnerPort({});

    await expect(commandRunner.run('unconfigured')).rejects.toThrow(
      'FakeCliCommandRunnerPort: no result configured for command "unconfigured".',
    );
  });

  it('re-throws a non-DisjointAllocationError from provisioning', async () => {
    const provisioner = new FakeWorktreeProvisioner(() => WORKTREE);
    provisioner.create = async () => {
      throw new Error('git worktree add failed: disk full');
    };
    const command = new CodeCommand(buildDeps({ worktreeProvisioner: provisioner }));

    await expect(command.run(['ORQ-35'])).rejects.toThrow('git worktree add failed: disk full');
  });

  it('succeeds without --ship, leaving the worktree uncommitted', async () => {
    const command = new CodeCommand(buildDeps());

    const result = await command.run(['ORQ-35']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Deterministic Coding Oracle: PASSED');
    expect(result.stdout).toContain('Worktree left uncommitted at /worktrees/ORQ-35');
  });

  it('exits 2 and reports the attempts when self-healing is exhausted', async () => {
    const commandRunner = new FakeCliCommandRunnerPort({
      [PASSING_COMMANDS.solidPreflight]: { exitCode: 1, stdout: '', stderr: 'scope drift' },
      [PASSING_COMMANDS.formatCheck]: OK,
      [PASSING_COMMANDS.buildAndLint]: OK,
      [PASSING_COMMANDS.testRun]: OK,
    });
    const command = new CodeCommand(
      buildDeps({
        commandRunnerFactory: () => commandRunner,
        maxSelfHealRetries: 1,
      }),
    );

    const result = await command.run(['ORQ-35']);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toContain('Deterministic Coding Oracle: EXHAUSTED');
    expect(result.stdout).toContain('Worktree left at /worktrees/ORQ-35 for inspection.');
  });

  it('exits 2 when the post-oracle rebase conflicts', async () => {
    const commandRunner = new FakeCliCommandRunnerPort({
      [PASSING_COMMANDS.solidPreflight]: OK,
      [PASSING_COMMANDS.formatCheck]: OK,
      [PASSING_COMMANDS.buildAndLint]: OK,
      [PASSING_COMMANDS.testRun]: OK,
      'git fetch origin': OK,
      'git rebase origin/develop': { exitCode: 1, stdout: '', stderr: 'conflict' },
      'git diff --name-only --diff-filter=U': { exitCode: 0, stdout: 'src/a.ts\n', stderr: '' },
      'git rebase --abort': OK,
    });
    const command = new CodeCommand(buildDeps({ commandRunnerFactory: () => commandRunner }));

    const result = await command.run(['ORQ-35']);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toContain('Rebase/re-verify failed');
    expect(result.stdout).toContain('"status":"conflict"');
  });

  it('exits 0 and reports the PR url when --ship succeeds', async () => {
    const shipService = new FakeCodeShipService({
      status: 'shipped',
      pullRequestUrl: 'https://pr/1',
    });
    const command = new CodeCommand(buildDeps({ shipServiceFactory: () => shipService }));

    const result = await command.run(['ORQ-35', '--ship']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Shipped: https://pr/1');
    expect(shipService.calls[0]?.taskId).toBe('ORQ-35');
    expect(shipService.calls[0]?.spec.issueKey).toBeNull();
  });

  it('exits 2 and reports the failed step when --ship fails', async () => {
    const shipService = new FakeCodeShipService({
      status: 'failed',
      failedStep: 'push',
      reason: 'auth error',
    });
    const command = new CodeCommand(buildDeps({ shipServiceFactory: () => shipService }));

    const result = await command.run(['ORQ-35', '--ship']);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toContain('Ship failed at step "push": auth error');
  });
});
