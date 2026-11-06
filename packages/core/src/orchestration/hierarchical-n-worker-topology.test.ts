import { describe, expect, it } from 'vitest';
import type { SpecialistOutput } from '../planning/types.js';
import {
  EmptyWorkerListError,
  HierarchicalNWorkerTopology,
} from './hierarchical-n-worker-topology.js';
import type { WorkerDispatcherPort, WorkerSpec } from './types.js';

function makeOutput(label: string): SpecialistOutput {
  return {
    branch: '2A',
    fileManifest: [{ kind: 'NEW', path: `src/${label}.ts` }],
    codeSnippets: [],
  };
}

class FakeWorkerDispatcherPort implements WorkerDispatcherPort {
  readonly dispatchedWorkers: WorkerSpec[] = [];

  constructor(private readonly outputsByWorkerName: Readonly<Record<string, SpecialistOutput>>) {}

  async dispatch(worker: WorkerSpec): Promise<SpecialistOutput> {
    this.dispatchedWorkers.push(worker);
    const output = this.outputsByWorkerName[worker.name];
    if (!output) {
      throw new Error(`No fake output configured for worker "${worker.name}".`);
    }
    return output;
  }
}

describe('HierarchicalNWorkerTopology', () => {
  it('reports its architecture name', () => {
    const workers: WorkerSpec[] = [{ name: 'solo', agent: 'claude_code' }];
    const dispatcher = new FakeWorkerDispatcherPort({ solo: makeOutput('solo') });

    expect(new HierarchicalNWorkerTopology(workers, dispatcher).architecture).toBe(
      'hierarchical_n_worker',
    );
  });

  it('throws EmptyWorkerListError when constructed with zero workers', () => {
    const dispatcher = new FakeWorkerDispatcherPort({});

    expect(() => new HierarchicalNWorkerTopology([], dispatcher)).toThrow(EmptyWorkerListError);
  });

  it('dispatches exactly two configured workers and joins them into the outputs map', async () => {
    const workers: WorkerSpec[] = [
      { name: 'architecture', agent: 'claude_code' },
      { name: 'contracts', agent: 'copilot_cli' },
    ];
    const outputs = {
      architecture: makeOutput('architecture'),
      contracts: makeOutput('contracts'),
    };
    const dispatcher = new FakeWorkerDispatcherPort(outputs);
    const topology = new HierarchicalNWorkerTopology(workers, dispatcher);

    const result = await topology.dispatch();

    expect(dispatcher.dispatchedWorkers).toEqual(workers);
    expect(result.outputs.get('architecture')).toBe(outputs.architecture);
    expect(result.outputs.get('contracts')).toBe(outputs.contracts);
    expect(result.outputs.size).toBe(2);
  });

  it('dispatches more than two configured workers and joins all of them', async () => {
    const workers: WorkerSpec[] = [
      { name: 'architecture', agent: 'claude_code' },
      { name: 'contracts', agent: 'copilot_cli' },
      { name: 'security_review', agent: 'claude_code' },
    ];
    const outputs = {
      architecture: makeOutput('architecture'),
      contracts: makeOutput('contracts'),
      security_review: makeOutput('security_review'),
    };
    const dispatcher = new FakeWorkerDispatcherPort(outputs);
    const topology = new HierarchicalNWorkerTopology(workers, dispatcher);

    const result = await topology.dispatch();

    expect(result.outputs.size).toBe(3);
    expect(result.outputs.get('security_review')).toBe(outputs.security_review);
  });
});
