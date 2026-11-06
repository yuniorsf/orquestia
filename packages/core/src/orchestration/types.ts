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
