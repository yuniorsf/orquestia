import { describe, expect, it } from 'vitest';
import { CodingOracleRunner } from './coding-oracle-runner.js';
import { CodingSelfHealingService } from './coding-self-healing-service.js';
import {
  FakeCheckpointPort,
  FakeCodingRemediationDispatcherPort,
  FakeCommandRunnerPort,
} from './test-builders.js';
import { InvalidCodingSelfHealConfigError, type OracleCommands } from './types.js';

const commands: OracleCommands = {
  solidPreflight: 'solid-preflight',
  formatCheck: 'format-check',
  buildAndLint: 'build-and-lint',
  testRun: 'test-run',
};

const ok = { exitCode: 0, stdout: '', stderr: '' };
const failing = { exitCode: 1, stdout: '', stderr: 'boom' };

function allOk(): Record<string, typeof ok> {
  return {
    [commands.solidPreflight]: ok,
    [commands.formatCheck]: ok,
    [commands.buildAndLint]: ok,
    [commands.testRun]: ok,
  };
}

describe('CodingSelfHealingService constructor', () => {
  it('rejects a negative maxRetries', () => {
    const commandRunner = new FakeCommandRunnerPort(allOk());
    expect(
      () =>
        new CodingSelfHealingService(
          new CodingOracleRunner(commandRunner),
          new FakeCheckpointPort(),
          new FakeCodingRemediationDispatcherPort(),
          { maxRetries: -1 },
        ),
    ).toThrow(InvalidCodingSelfHealConfigError);
  });
});

describe('CodingSelfHealingService.run', () => {
  it('returns "passed" immediately when the first oracle run already passes', async () => {
    const commandRunner = new FakeCommandRunnerPort(allOk());
    const checkpoint = new FakeCheckpointPort();
    const dispatcher = new FakeCodingRemediationDispatcherPort();
    const service = new CodingSelfHealingService(
      new CodingOracleRunner(commandRunner),
      checkpoint,
      dispatcher,
      { maxRetries: 3 },
    );

    const outcome = await service.run(commands);

    expect(outcome.status).toBe('passed');
    expect(outcome.attempts).toHaveLength(1);
    expect(checkpoint.createdHandles).toHaveLength(0);
    expect(dispatcher.calls).toHaveLength(0);
  });

  it('checkpoints, remediates, and converges without a rollback when the fix succeeds', async () => {
    const commandRunner = new FakeCommandRunnerPort({
      ...allOk(),
      [commands.formatCheck]: failing,
    });
    const checkpoint = new FakeCheckpointPort();
    const dispatcher = new FakeCodingRemediationDispatcherPort(() => {
      commandRunner.setResult(commands.formatCheck, ok);
    });
    const service = new CodingSelfHealingService(
      new CodingOracleRunner(commandRunner),
      checkpoint,
      dispatcher,
      { maxRetries: 3 },
    );

    const outcome = await service.run(commands);

    expect(outcome.status).toBe('passed');
    expect(outcome.attempts).toHaveLength(2);
    expect(outcome.attempts[1]?.rolledBack).toBe(false);
    expect(checkpoint.createdHandles).toHaveLength(1);
    expect(checkpoint.rolledBackHandles).toHaveLength(0);
    expect(dispatcher.calls).toEqual([{ exitCode: 10, failedStage: 'formatCheck' }]);
  });

  it('rolls back the checkpoint when a remediation attempt fails to converge', async () => {
    const commandRunner = new FakeCommandRunnerPort({
      ...allOk(),
      [commands.buildAndLint]: failing,
    });
    const checkpoint = new FakeCheckpointPort();
    const dispatcher = new FakeCodingRemediationDispatcherPort(); // no-op: never fixes it
    const service = new CodingSelfHealingService(
      new CodingOracleRunner(commandRunner),
      checkpoint,
      dispatcher,
      { maxRetries: 1 },
    );

    const outcome = await service.run(commands);

    expect(outcome.status).toBe('exhausted');
    expect(outcome.attempts).toHaveLength(2);
    expect(outcome.attempts[1]?.rolledBack).toBe(true);
    expect(checkpoint.rolledBackHandles).toEqual(checkpoint.createdHandles);
  });

  it('retries up to maxRetries, rolling back each non-convergent attempt, then reports "exhausted"', async () => {
    const commandRunner = new FakeCommandRunnerPort({ ...allOk(), [commands.testRun]: failing });
    const checkpoint = new FakeCheckpointPort();
    const dispatcher = new FakeCodingRemediationDispatcherPort();
    const service = new CodingSelfHealingService(
      new CodingOracleRunner(commandRunner),
      checkpoint,
      dispatcher,
      { maxRetries: 3 },
    );

    const outcome = await service.run(commands);

    expect(outcome.status).toBe('exhausted');
    expect(outcome.attempts).toHaveLength(4); // initial + 3 retries
    expect(dispatcher.calls).toHaveLength(3);
    expect(checkpoint.rolledBackHandles).toHaveLength(3);
  });

  it('performs a single oracle run with no healing when maxRetries is 0', async () => {
    const commandRunner = new FakeCommandRunnerPort({ ...allOk(), [commands.testRun]: failing });
    const checkpoint = new FakeCheckpointPort();
    const dispatcher = new FakeCodingRemediationDispatcherPort();
    const service = new CodingSelfHealingService(
      new CodingOracleRunner(commandRunner),
      checkpoint,
      dispatcher,
      { maxRetries: 0 },
    );

    const outcome = await service.run(commands);

    expect(outcome.status).toBe('exhausted');
    expect(outcome.attempts).toHaveLength(1);
    expect(dispatcher.calls).toHaveLength(0);
  });
});
