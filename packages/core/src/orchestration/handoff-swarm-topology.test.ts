import { describe, expect, it } from 'vitest';
import type { SpecialistOutput } from '../planning/types.js';
import { EmptyWorkerListError } from './hierarchical-n-worker-topology.js';
import { HandoffSwarmTopology } from './handoff-swarm-topology.js';
import type { WorkerDispatcherPort, WorkerSpec } from './types.js';

function makeOutput(label: string): SpecialistOutput {
  return {
    branch: '2A',
    fileManifest: [{ kind: 'NEW', path: `src/${label}.ts` }],
    codeSnippets: [],
  };
}

class RecordingWorkerDispatcherPort implements WorkerDispatcherPort {
  readonly dispatchOrder: string[] = [];

  constructor(private readonly outputsByWorkerName: Readonly<Record<string, SpecialistOutput>>) {}

  async dispatch(worker: WorkerSpec): Promise<SpecialistOutput> {
    this.dispatchOrder.push(worker.name);
    const output = this.outputsByWorkerName[worker.name];
    if (!output) {
      throw new Error(`No fake output configured for worker "${worker.name}".`);
    }
    return output;
  }
}

describe('HandoffSwarmTopology', () => {
  it('reports its architecture name', () => {
    const workers: WorkerSpec[] = [{ name: 'solo', agent: 'claude_code' }];
    const dispatcher = new RecordingWorkerDispatcherPort({ solo: makeOutput('solo') });

    expect(new HandoffSwarmTopology(workers, dispatcher).architecture).toBe('handoff_swarm');
  });

  it('throws EmptyWorkerListError when constructed with zero workers', () => {
    const dispatcher = new RecordingWorkerDispatcherPort({});

    expect(() => new HandoffSwarmTopology([], dispatcher)).toThrow(EmptyWorkerListError);
  });

  it('dispatches configured workers strictly in order, not in parallel', async () => {
    const workers: WorkerSpec[] = [
      { name: 'first', agent: 'claude_code' },
      { name: 'second', agent: 'copilot_cli' },
    ];
    const outputs = { first: makeOutput('first'), second: makeOutput('second') };
    const dispatchOrder: string[] = [];
    let releaseFirst: (() => void) | undefined;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const dispatcher: WorkerDispatcherPort = {
      async dispatch(worker) {
        dispatchOrder.push(worker.name);
        if (worker.name === 'first') {
          await firstGate;
        }
        const output = outputs[worker.name as keyof typeof outputs];
        if (!output) {
          throw new Error(`No fake output configured for worker "${worker.name}".`);
        }
        return output;
      },
    };
    const topology = new HandoffSwarmTopology(workers, dispatcher);

    const dispatchPromise = topology.dispatch();
    await Promise.resolve();
    await Promise.resolve();

    // If dispatch were parallel (Promise.all), "second" would already have
    // been called by now even though "first" is still gated. Sequential
    // handoff must not have called it yet.
    expect(dispatchOrder).toEqual(['first']);

    releaseFirst?.();
    const result = await dispatchPromise;

    expect(dispatchOrder).toEqual(['first', 'second']);
    expect(result.outputs.get('first')).toBe(outputs.first);
    expect(result.outputs.get('second')).toBe(outputs.second);
    expect(result.outputs.size).toBe(2);
  });
});
