import type { SpecialistOutput } from '../planning/types.js';
import { EmptyWorkerListError } from './hierarchical-n-worker-topology.js';
import type {
  OrchestrationResult,
  OrchestrationTopologyPort,
  WorkerDispatcherPort,
  WorkerSpec,
} from './types.js';

/**
 * Peer-to-peer baton-passing: dispatches the configured workers in
 * sequence (order matters, unlike `HierarchicalNWorkerTopology`'s parallel
 * fan-out) rather than through a central join barrier after a parallel
 * dispatch — each worker completes before the next one starts. Still
 * assumes disjoint ownership of in-flight work; see
 * `orchestration.handoff_swarm.workers[]`.
 */
export class HandoffSwarmTopology implements OrchestrationTopologyPort {
  readonly architecture = 'handoff_swarm';

  constructor(
    private readonly workers: readonly WorkerSpec[],
    private readonly dispatcher: WorkerDispatcherPort,
  ) {
    if (workers.length === 0) {
      throw new EmptyWorkerListError();
    }
  }

  async dispatch(): Promise<OrchestrationResult> {
    const outputs = new Map<string, SpecialistOutput>();
    for (const worker of this.workers) {
      outputs.set(worker.name, await this.dispatcher.dispatch(worker));
    }
    return { outputs };
  }
}
