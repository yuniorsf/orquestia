import { describe, expect, it } from 'vitest';
import type {
  ManifestConflictRemediationDispatcherPort,
  SpecialistOutput,
} from '../planning/types.js';
import { ManifestConflictSelfHealingService } from './manifest-conflict-self-healing-service.js';

class FakeDispatcher implements ManifestConflictRemediationDispatcherPort {
  readonly calls: Array<readonly string[]> = [];

  constructor(private readonly outputs: readonly SpecialistOutput[]) {}

  async remediate(overlappingPaths: readonly string[]): Promise<SpecialistOutput> {
    this.calls.push(overlappingPaths);
    return this.outputs[this.calls.length - 1] as SpecialistOutput;
  }
}

function output(branch: '2A' | '2B', paths: readonly string[]): SpecialistOutput {
  return { branch, fileManifest: paths.map((path) => ({ path, kind: 'NEW' })), codeSnippets: [] };
}

describe('ManifestConflictSelfHealingService', () => {
  it('passes through immediately, with zero remediation calls, when there is no overlap', async () => {
    const dispatcher = new FakeDispatcher([]);
    const service = new ManifestConflictSelfHealingService(dispatcher, { maxRetries: 2 });

    const outcome = await service.run(output('2A', ['a.ts']), output('2B', ['b.ts']));

    expect(outcome).toEqual({
      status: 'passed',
      branchA: output('2A', ['a.ts']),
      branchB: output('2B', ['b.ts']),
      attempts: 0,
    });
    expect(dispatcher.calls).toEqual([]);
  });

  it('resolves after one remediation round, reporting the overlapping paths to the dispatcher', async () => {
    const healed = output('2B', ['b.test.ts']);
    const dispatcher = new FakeDispatcher([healed]);
    const service = new ManifestConflictSelfHealingService(dispatcher, { maxRetries: 2 });

    const outcome = await service.run(output('2A', ['a.ts']), output('2B', ['a.ts']));

    expect(outcome).toEqual({
      status: 'passed',
      branchA: output('2A', ['a.ts']),
      branchB: healed,
      attempts: 1,
    });
    expect(dispatcher.calls).toEqual([['a.ts']]);
  });

  it('retries up to maxRetries, reporting the still-current overlap each time', async () => {
    const stillOverlapping = output('2B', ['a.ts']);
    const dispatcher = new FakeDispatcher([stillOverlapping, stillOverlapping]);
    const service = new ManifestConflictSelfHealingService(dispatcher, { maxRetries: 2 });

    const outcome = await service.run(output('2A', ['a.ts']), output('2B', ['a.ts']));

    expect(outcome.status).toBe('exhausted');
    expect(outcome.attempts).toBe(2);
    expect(dispatcher.calls).toEqual([['a.ts'], ['a.ts']]);
  });

  it('respects maxRetries: 0 — reports exhausted immediately with zero dispatcher calls', async () => {
    const dispatcher = new FakeDispatcher([]);
    const service = new ManifestConflictSelfHealingService(dispatcher, { maxRetries: 0 });

    const outcome = await service.run(output('2A', ['a.ts']), output('2B', ['a.ts']));

    expect(outcome.status).toBe('exhausted');
    expect(outcome.attempts).toBe(0);
    expect(dispatcher.calls).toEqual([]);
  });

  it('stops retrying as soon as the overlap resolves, even with retries remaining', async () => {
    const healed = output('2B', ['b.test.ts']);
    const dispatcher = new FakeDispatcher([healed]);
    const service = new ManifestConflictSelfHealingService(dispatcher, { maxRetries: 5 });

    const outcome = await service.run(output('2A', ['a.ts']), output('2B', ['a.ts']));

    expect(outcome.attempts).toBe(1);
    expect(dispatcher.calls).toHaveLength(1);
  });
});
