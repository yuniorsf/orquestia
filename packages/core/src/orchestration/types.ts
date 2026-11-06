import type { SpecialistOutput } from '../planning/types.js';

/**
 * Generalized join result of an {@link OrchestrationTopologyPort}'s dispatch
 * — keyed by worker name rather than a fixed `branchA`/`branchB` shape, so a
 * topology can fan out to any number of workers.
 */
export interface OrchestrationResult {
  readonly outputs: ReadonlyMap<string, SpecialistOutput>;
}

/**
 * Selects the shape of the DAG itself (how many workers, how they're
 * dispatched and joined) — orthogonal to {@link StrategyRouter}, which only
 * selects which model backs a single, already-fixed phase. See
 * `orquestia.config.yaml`'s `orchestration.architecture`.
 */
export interface OrchestrationTopologyPort {
  readonly architecture: string;
  dispatch(): Promise<OrchestrationResult>;
}

/** One entry of `orchestration.hierarchical_n_worker.workers[]`. */
export interface WorkerSpec {
  readonly name: string;
  readonly agent: string;
}

/** Dispatches a single named worker; the real adapter routes through `AgentRouter` by `worker.agent`. */
export interface WorkerDispatcherPort {
  dispatch(worker: WorkerSpec): Promise<SpecialistOutput>;
}

export interface HierarchicalNWorkerConfig {
  readonly workers: readonly WorkerSpec[];
}

export interface HandoffSwarmConfig {
  readonly workers: readonly WorkerSpec[];
}

export interface BlackboardConfig {
  readonly contributors: readonly WorkerSpec[];
}

export type OrchestrationConfig =
  | { readonly architecture: 'fixed_tri_planar' }
  | {
      readonly architecture: 'hierarchical_n_worker';
      readonly hierarchicalNWorker: HierarchicalNWorkerConfig;
    }
  | { readonly architecture: 'handoff_swarm'; readonly handoffSwarm: HandoffSwarmConfig }
  | { readonly architecture: 'blackboard'; readonly blackboard: BlackboardConfig };

export class InvalidOrchestrationConfigError extends Error {
  constructor(message: string) {
    super(`Invalid "orchestration" config section in orquestia.config.yaml: ${message}`);
    this.name = 'InvalidOrchestrationConfigError';
  }
}
