import { describe, expect, it } from 'vitest';
import { CodingOracleRunner } from './coding-oracle-runner.js';
import { FakeCommandRunnerPort } from './test-builders.js';
import type { OracleCommands } from './types.js';

const commands: OracleCommands = {
  solidPreflight: 'solid-preflight',
  formatCheck: 'format-check',
  buildAndLint: 'build-and-lint',
  testRun: 'test-run',
};

const ok = { exitCode: 0, stdout: '', stderr: '' };

describe('CodingOracleRunner.run', () => {
  it('passes with exit code 0 when every stage succeeds, running all 4 in order', async () => {
    const commandRunner = new FakeCommandRunnerPort({
      [commands.solidPreflight]: ok,
      [commands.formatCheck]: ok,
      [commands.buildAndLint]: ok,
      [commands.testRun]: ok,
    });
    const runner = new CodingOracleRunner(commandRunner);

    const result = await runner.run(commands);

    expect(result.passed).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.failedStage).toBeNull();
    expect(commandRunner.calls).toEqual([
      commands.solidPreflight,
      commands.formatCheck,
      commands.buildAndLint,
      commands.testRun,
    ]);
  });

  it('halts at Stage 1 (SOLID preflight) with exit code 10, never running later stages', async () => {
    const commandRunner = new FakeCommandRunnerPort({
      [commands.solidPreflight]: { exitCode: 10, stdout: '', stderr: 'scope violation' },
    });
    const runner = new CodingOracleRunner(commandRunner);

    const result = await runner.run(commands);

    expect(result).toMatchObject({ passed: false, exitCode: 10, failedStage: 'solidPreflight' });
    expect(commandRunner.calls).toEqual([commands.solidPreflight]);
  });

  it('halts at Stage 2 (format check) with exit code 10', async () => {
    const commandRunner = new FakeCommandRunnerPort({
      [commands.solidPreflight]: ok,
      [commands.formatCheck]: { exitCode: 1, stdout: '', stderr: 'style drift' },
    });
    const runner = new CodingOracleRunner(commandRunner);

    const result = await runner.run(commands);

    expect(result).toMatchObject({ passed: false, exitCode: 10, failedStage: 'formatCheck' });
    expect(commandRunner.calls).toEqual([commands.solidPreflight, commands.formatCheck]);
  });

  it('halts at Stage 3 (build & lint) with exit code 20', async () => {
    const commandRunner = new FakeCommandRunnerPort({
      [commands.solidPreflight]: ok,
      [commands.formatCheck]: ok,
      [commands.buildAndLint]: { exitCode: 1, stdout: '', stderr: 'type error' },
    });
    const runner = new CodingOracleRunner(commandRunner);

    const result = await runner.run(commands);

    expect(result).toMatchObject({ passed: false, exitCode: 20, failedStage: 'buildAndLint' });
    expect(commandRunner.calls).toEqual([
      commands.solidPreflight,
      commands.formatCheck,
      commands.buildAndLint,
    ]);
  });

  it('halts at Stage 4 (test run) with exit code 30', async () => {
    const commandRunner = new FakeCommandRunnerPort({
      [commands.solidPreflight]: ok,
      [commands.formatCheck]: ok,
      [commands.buildAndLint]: ok,
      [commands.testRun]: { exitCode: 1, stdout: '', stderr: 'assertion failed' },
    });
    const runner = new CodingOracleRunner(commandRunner);

    const result = await runner.run(commands);

    expect(result).toMatchObject({ passed: false, exitCode: 30, failedStage: 'testRun' });
    expect(result.runs).toHaveLength(4);
  });
});

describe('FakeCommandRunnerPort', () => {
  it('fails loudly when a stage command has no configured result', async () => {
    const commandRunner = new FakeCommandRunnerPort({});
    const runner = new CodingOracleRunner(commandRunner);

    await expect(runner.run(commands)).rejects.toThrow('no result configured');
  });
});
