import type { BaselineGitStatus, OrquestiaConfig, SpecialistOutput } from '@orquestia/core';
import { describe, expect, it } from 'vitest';
import { PlanCommand } from './plan-command.js';
import {
  FakeConfigReaderPort,
  FakeFileExistencePort,
  FakeGitStatusPort,
  FakeSpecialistDispatcherPort,
} from './test-builders.js';

const CLEAN_STATUS: BaselineGitStatus = { porcelain: '', headSha: 'abc1234', isClean: true };
const EMPTY_CONFIG: OrquestiaConfig = { version: '1', projectName: 'p', raw: {} };

const BRANCH_A: SpecialistOutput = { branch: '2A', fileManifest: [], codeSnippets: [] };
const BRANCH_B: SpecialistOutput = { branch: '2B', fileManifest: [], codeSnippets: [] };

function buildCommand(options?: {
  config?: OrquestiaConfig | Error;
  branchA?: SpecialistOutput;
  branchB?: SpecialistOutput;
  gitStatus?: BaselineGitStatus;
}): PlanCommand {
  return new PlanCommand(
    new FakeGitStatusPort(options?.gitStatus ?? CLEAN_STATUS),
    new FakeConfigReaderPort(options?.config ?? EMPTY_CONFIG),
    new FakeFileExistencePort(),
    () =>
      new FakeSpecialistDispatcherPort({
        '2A': options?.branchA ?? BRANCH_A,
        '2B': options?.branchB ?? BRANCH_B,
      }),
  );
}

describe('PlanCommand', () => {
  it('rejects a call with no taskId', async () => {
    const command = buildCommand();

    const result = await command.run([]);

    expect(result).toEqual({ exitCode: 1, stdout: '', stderr: 'Usage: orquestia plan <taskId>\n' });
  });

  it('reports a passing oracle result with both branches empty', async () => {
    const command = buildCommand();

    const result = await command.run(['ORQ-34']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Plan: ORQ-34');
    expect(result.stdout).toContain('Deterministic Plan Oracle: PASSED (0 findings).');
    expect(result.stderr).toBe('');
  });

  it("includes each branch's file manifest in the report", async () => {
    const command = buildCommand({
      branchA: {
        branch: '2A',
        fileManifest: [{ path: 'src/foo.ts', kind: 'NEW' }],
        codeSnippets: [],
      },
    });

    const result = await command.run(['ORQ-34']);

    expect(result.stdout).toContain('[NEW] src/foo.ts');
  });

  it('reports "(none)" for an empty branch manifest', async () => {
    const command = buildCommand();

    const result = await command.run(['ORQ-34']);

    expect(result.stdout).toContain('(none)');
  });

  it('exits 2 with gate findings listed when the oracle fails', async () => {
    const command = buildCommand({
      branchA: {
        branch: '2A',
        fileManifest: [{ path: 'src/foo.ts', kind: 'MODIFY' }],
        codeSnippets: [],
      },
    });

    const result = await command.run(['ORQ-34']);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toContain('Deterministic Plan Oracle: FAILED');
    expect(result.stdout).toContain('[Gate 10]');
  });

  it('reports a clean failure instead of crashing when specialist dispatch throws', async () => {
    const command = new PlanCommand(
      new FakeGitStatusPort(CLEAN_STATUS),
      new FakeConfigReaderPort(EMPTY_CONFIG),
      new FakeFileExistencePort(),
      () => ({
        dispatch: async () => {
          throw new Error('agent CLI exited non-zero');
        },
      }),
    );

    const result = await command.run(['ORQ-34']);

    expect(result).toEqual({
      exitCode: 1,
      stdout: '',
      stderr: 'Specialist dispatch failed for "ORQ-34": agent CLI exited non-zero\n',
    });
  });

  it('stringifies a non-Error throw from specialist dispatch', async () => {
    const command = new PlanCommand(
      new FakeGitStatusPort(CLEAN_STATUS),
      new FakeConfigReaderPort(EMPTY_CONFIG),
      new FakeFileExistencePort(),
      () => ({
        dispatch: async () => {
          throw 'raw failure';
        },
      }),
    );

    const result = await command.run(['ORQ-34']);

    expect(result.stderr).toBe('Specialist dispatch failed for "ORQ-34": raw failure\n');
  });

  it('reports a Gate 2 zero-mutation finding when git status changes mid-dispatch', async () => {
    const gitStatusPort = new FakeGitStatusPort(CLEAN_STATUS);
    const command = new PlanCommand(
      gitStatusPort,
      new FakeConfigReaderPort(EMPTY_CONFIG),
      new FakeFileExistencePort(),
      () => {
        // Simulate a specialist mutating the workspace mid-dispatch, which
        // the baseline-vs-current git status comparison (Gate 0) must catch.
        gitStatusPort.setStatus({ porcelain: ' M src/foo.ts', headSha: 'abc1234', isClean: false });
        return new FakeSpecialistDispatcherPort({ '2A': BRANCH_A, '2B': BRANCH_B });
      },
    );

    const result = await command.run(['ORQ-34']);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toContain('[Gate 2]');
  });

  it('falls back to a default config when loading orquestia.config.yaml fails', async () => {
    const command = buildCommand({ config: new Error('ENOENT') });

    const result = await command.run(['ORQ-34']);

    expect(result.exitCode).toBe(0);
  });

  it('reads guardrail_patterns/domain_core_dirs/forbidden_core_imports from the plan_oracle config section', async () => {
    const config: OrquestiaConfig = {
      version: '1',
      projectName: 'p',
      raw: {
        plan_oracle: {
          domain_core_dirs: ['src/domain'],
          forbidden_core_imports: ['node:fs'],
          guardrail_patterns: [{ pattern: 'eval\\(', message: 'no eval' }],
        },
      },
    };
    const command = buildCommand({
      config,
      branchA: {
        branch: '2A',
        fileManifest: [{ path: 'src/domain/foo.ts', kind: 'NEW' }],
        codeSnippets: ["import fs from 'node:fs';"],
      },
    });

    const result = await command.run(['ORQ-34']);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toContain('[Gate 30]');
  });

  it('treats a non-mapping plan_oracle section as absent (empty defaults)', async () => {
    const config: OrquestiaConfig = {
      version: '1',
      projectName: 'p',
      raw: { plan_oracle: 'nope' },
    };
    const command = buildCommand({ config });

    const result = await command.run(['ORQ-34']);

    expect(result.exitCode).toBe(0);
  });

  it('treats non-array plan_oracle sub-fields as empty defaults', async () => {
    const config: OrquestiaConfig = {
      version: '1',
      projectName: 'p',
      raw: {
        plan_oracle: {
          domain_core_dirs: 'nope',
          forbidden_core_imports: 'nope',
          guardrail_patterns: 'nope',
        },
      },
    };
    const command = buildCommand({ config });

    const result = await command.run(['ORQ-34']);

    expect(result.exitCode).toBe(0);
  });
});
