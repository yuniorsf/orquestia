import { describe, expect, it } from 'vitest';
import type { Clock } from '../shared/clock.js';
import type { SpecialistOutput } from '../planning/types.js';
import { BlackboardTopology } from './blackboard-topology.js';
import { EmptyWorkerListError } from './hierarchical-n-worker-topology.js';
import type { WorkerDispatcherPort, WorkerSpec } from './types.js';

function makeOutput(paths: readonly string[]): SpecialistOutput {
  return {
    branch: '2A',
    fileManifest: paths.map((path) => ({ kind: 'NEW' as const, path })),
    codeSnippets: [],
  };
}

class SequenceClock implements Clock {
  private tick = 0;

  now(): number {
    this.tick += 1;
    return this.tick;
  }
}

class FakeWorkerDispatcherPort implements WorkerDispatcherPort {
  constructor(private readonly outputsByWorkerName: Readonly<Record<string, SpecialistOutput>>) {}

  async dispatch(worker: WorkerSpec): Promise<SpecialistOutput> {
    const output = this.outputsByWorkerName[worker.name];
    if (!output) {
      throw new Error(`No fake output configured for worker "${worker.name}".`);
    }
    return output;
  }
}

describe('BlackboardTopology', () => {
  it('reports its architecture name', () => {
    const contributors: WorkerSpec[] = [{ name: 'solo', agent: 'claude_code' }];
    const dispatcher = new FakeWorkerDispatcherPort({ solo: makeOutput(['a.ts']) });

    expect(new BlackboardTopology(contributors, dispatcher, new SequenceClock()).architecture).toBe(
      'blackboard',
    );
  });

  it('throws EmptyWorkerListError when constructed with zero contributors', () => {
    const dispatcher = new FakeWorkerDispatcherPort({});

    expect(() => new BlackboardTopology([], dispatcher, new SequenceClock())).toThrow(
      EmptyWorkerListError,
    );
  });

  it('keeps every contributor fully when no two claim the same file path', async () => {
    const contributors: WorkerSpec[] = [
      { name: 'alpha', agent: 'claude_code' },
      { name: 'beta', agent: 'copilot_cli' },
    ];
    const outputs = { alpha: makeOutput(['a.ts']), beta: makeOutput(['b.ts']) };
    const topology = new BlackboardTopology(
      contributors,
      new FakeWorkerDispatcherPort(outputs),
      new SequenceClock(),
    );

    const result = await topology.dispatch();

    expect(result.outputs.get('alpha')?.fileManifest).toEqual([{ kind: 'NEW', path: 'a.ts' }]);
    expect(result.outputs.get('beta')?.fileManifest).toEqual([{ kind: 'NEW', path: 'b.ts' }]);
  });

  it('resolves a contested path to whichever contribution has the later writtenAt timestamp', async () => {
    const contributors: WorkerSpec[] = [
      { name: 'alpha', agent: 'claude_code' },
      { name: 'beta', agent: 'copilot_cli' },
    ];
    // Both claim shared.ts; SequenceClock.now() increments each call, so
    // "beta" (dispatched second by Promise.all's map order) gets the
    // later timestamp and wins the contested path.
    const outputs = {
      alpha: makeOutput(['shared.ts', 'a-only.ts']),
      beta: makeOutput(['shared.ts', 'b-only.ts']),
    };
    const topology = new BlackboardTopology(
      contributors,
      new FakeWorkerDispatcherPort(outputs),
      new SequenceClock(),
    );

    const result = await topology.dispatch();

    expect(result.outputs.get('alpha')?.fileManifest).toEqual([{ kind: 'NEW', path: 'a-only.ts' }]);
    expect(result.outputs.get('beta')?.fileManifest).toEqual([
      { kind: 'NEW', path: 'shared.ts' },
      { kind: 'NEW', path: 'b-only.ts' },
    ]);
  });

  it('breaks a tie (equal writtenAt) deterministically in favor of the earlier contributor', async () => {
    const contributors: WorkerSpec[] = [
      { name: 'alpha', agent: 'claude_code' },
      { name: 'beta', agent: 'copilot_cli' },
    ];
    const outputs = { alpha: makeOutput(['shared.ts']), beta: makeOutput(['shared.ts']) };
    const frozenClock: Clock = { now: () => 42 };
    const topology = new BlackboardTopology(
      contributors,
      new FakeWorkerDispatcherPort(outputs),
      frozenClock,
    );

    const result = await topology.dispatch();

    expect(result.outputs.get('alpha')?.fileManifest).toEqual([{ kind: 'NEW', path: 'shared.ts' }]);
    expect(result.outputs.get('beta')?.fileManifest).toEqual([]);
  });

  it('leaves codeSnippets untouched per contributor (not path-keyed, so not merged)', async () => {
    const contributors: WorkerSpec[] = [{ name: 'alpha', agent: 'claude_code' }];
    const output: SpecialistOutput = {
      branch: '2A',
      fileManifest: [{ kind: 'NEW', path: 'a.ts' }],
      codeSnippets: ['const x = 1;'],
    };
    const topology = new BlackboardTopology(
      contributors,
      new FakeWorkerDispatcherPort({ alpha: output }),
      new SequenceClock(),
    );

    const result = await topology.dispatch();

    expect(result.outputs.get('alpha')?.codeSnippets).toEqual(['const x = 1;']);
  });
});
