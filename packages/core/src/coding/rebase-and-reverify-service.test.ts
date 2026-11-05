import { describe, expect, it } from 'vitest';
import { CodingOracleRunner } from './coding-oracle-runner.js';
import { RebaseAndReverifyService } from './rebase-and-reverify-service.js';
import { FakeCommandRunnerPort } from './test-builders.js';
import type { OracleCommands } from './types.js';

const baseRef = 'origin/develop';

const oracleCommands: OracleCommands = {
  solidPreflight: 'solid-preflight',
  formatCheck: 'format-check',
  buildAndLint: 'build-and-lint',
  testRun: 'test-run',
};

const ok = { exitCode: 0, stdout: '', stderr: '' };

describe('RebaseAndReverifyService.run', () => {
  it('reports a failed outcome when the fetch itself fails, never attempting the rebase', async () => {
    const commandRunner = new FakeCommandRunnerPort({
      'git fetch origin': { exitCode: 1, stdout: '', stderr: 'network unreachable' },
    });
    const service = new RebaseAndReverifyService(
      commandRunner,
      new CodingOracleRunner(commandRunner),
    );

    const result = await service.run(baseRef, oracleCommands);

    expect(result).toEqual({
      rebase: { status: 'failed', reason: 'network unreachable' },
      oracle: null,
    });
    expect(commandRunner.calls).toEqual(['git fetch origin']);
  });

  it('falls back to stdout as the reason when the fetch failure has empty stderr', async () => {
    const commandRunner = new FakeCommandRunnerPort({
      'git fetch origin': { exitCode: 1, stdout: 'fatal: could not read from remote', stderr: '' },
    });
    const service = new RebaseAndReverifyService(
      commandRunner,
      new CodingOracleRunner(commandRunner),
    );

    const result = await service.run(baseRef, oracleCommands);

    expect(result.rebase).toEqual({
      status: 'failed',
      reason: 'fatal: could not read from remote',
    });
  });

  it('reports a conflict outcome and aborts the rebase when unmerged paths remain', async () => {
    const commandRunner = new FakeCommandRunnerPort({
      'git fetch origin': ok,
      [`git rebase ${baseRef}`]: { exitCode: 1, stdout: '', stderr: 'CONFLICT (content)' },
      'git diff --name-only --diff-filter=U': {
        exitCode: 0,
        stdout: 'src/core/widget.ts\nsrc/core/other.ts\n',
        stderr: '',
      },
      'git rebase --abort': ok,
    });
    const service = new RebaseAndReverifyService(
      commandRunner,
      new CodingOracleRunner(commandRunner),
    );

    const result = await service.run(baseRef, oracleCommands);

    expect(result).toEqual({
      rebase: { status: 'conflict', conflictingFiles: ['src/core/widget.ts', 'src/core/other.ts'] },
      oracle: null,
    });
    expect(commandRunner.calls).toEqual([
      'git fetch origin',
      `git rebase ${baseRef}`,
      'git diff --name-only --diff-filter=U',
      'git rebase --abort',
    ]);
  });

  it('reports a failed outcome and aborts when the rebase fails for a non-conflict reason', async () => {
    const commandRunner = new FakeCommandRunnerPort({
      'git fetch origin': ok,
      [`git rebase ${baseRef}`]: {
        exitCode: 128,
        stdout: '',
        stderr: 'fatal: no rebase in progress',
      },
      'git diff --name-only --diff-filter=U': { exitCode: 0, stdout: '', stderr: '' },
      'git rebase --abort': ok,
    });
    const service = new RebaseAndReverifyService(
      commandRunner,
      new CodingOracleRunner(commandRunner),
    );

    const result = await service.run(baseRef, oracleCommands);

    expect(result).toEqual({
      rebase: { status: 'failed', reason: 'fatal: no rebase in progress' },
      oracle: null,
    });
  });

  it('re-runs the Phase 3 oracle after a clean rebase and returns its result', async () => {
    const commandRunner = new FakeCommandRunnerPort({
      'git fetch origin': ok,
      [`git rebase ${baseRef}`]: ok,
      [oracleCommands.solidPreflight]: ok,
      [oracleCommands.formatCheck]: ok,
      [oracleCommands.buildAndLint]: ok,
      [oracleCommands.testRun]: ok,
    });
    const service = new RebaseAndReverifyService(
      commandRunner,
      new CodingOracleRunner(commandRunner),
    );

    const result = await service.run(baseRef, oracleCommands);

    expect(result.rebase).toEqual({ status: 'clean' });
    expect(result.oracle).toMatchObject({ passed: true, exitCode: 0 });
    expect(commandRunner.calls).toEqual([
      'git fetch origin',
      `git rebase ${baseRef}`,
      oracleCommands.solidPreflight,
      oracleCommands.formatCheck,
      oracleCommands.buildAndLint,
      oracleCommands.testRun,
    ]);
  });

  it('propagates a post-rebase oracle failure (never trusting the pre-rebase green)', async () => {
    const commandRunner = new FakeCommandRunnerPort({
      'git fetch origin': ok,
      [`git rebase ${baseRef}`]: ok,
      [oracleCommands.solidPreflight]: ok,
      [oracleCommands.formatCheck]: ok,
      [oracleCommands.buildAndLint]: { exitCode: 1, stdout: '', stderr: 'type error post-rebase' },
    });
    const service = new RebaseAndReverifyService(
      commandRunner,
      new CodingOracleRunner(commandRunner),
    );

    const result = await service.run(baseRef, oracleCommands);

    expect(result.rebase).toEqual({ status: 'clean' });
    expect(result.oracle).toMatchObject({
      passed: false,
      exitCode: 20,
      failedStage: 'buildAndLint',
    });
  });
});
