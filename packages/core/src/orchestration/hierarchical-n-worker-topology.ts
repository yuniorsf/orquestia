import type { SpecialistOutput } from '../planning/types.js';
import type {
  OrchestrationResult,
  OrchestrationTopologyPort,
  WorkerDispatcherPort,
  WorkerSpec,
} from './types.js';

export class EmptyWorkerListError extends Error {
  constructor() {
    super('HierarchicalNWorkerTopology requires at least one configured worker.');
    this.name = 'EmptyWorkerListError';
  }
}

/**
 * Generalizes the fixed 2A/2B dispatch to an open, config-declared list of
 * named workers (`orchestration.hierarchical_n_worker.workers[]`) — still a
 * central supervisor/join barrier and still disjoint ownership (see the
 * generalized Gate 1 check, `verify_worker_scopes` in
 * `verify-solid-contracts.py`), just not fixed at exactly two.
 */
export class HierarchicalNWorkerTopology implements OrchestrationTopologyPort {
  readonly architecture = 'hierarchical_n_worker';

  constructor(
    private readonly workers: readonly WorkerSpec[],
    private readonly dispatcher: WorkerDispatcherPort,
  ) {
    if (workers.length === 0) {
      throw new EmptyWorkerListError();
    }
  }

  async dispatch(): Promise<OrchestrationResult> {
    const entries = await Promise.all(
      this.workers.map(async (worker): Promise<readonly [string, SpecialistOutput]> => [
        worker.name,
        await this.dispatcher.dispatch(worker),
      ]),
    );

    return { outputs: new Map(entries) };
  }
}
