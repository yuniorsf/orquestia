import type { SpecialistDispatcherPort, SpecialistOutput } from './types.js';

export interface PlanDispatchResult {
  readonly branchA: SpecialistOutput;
  readonly branchB: SpecialistOutput;
}

/**
 * Phase 2 of the Planning DAG: dispatches the read-only Branch 2A
 * (architecture & domain) and Branch 2B (contracts & QA matrix) specialists
 * in parallel and joins on their structured outputs.
 */
export class PlanDispatchService {
  constructor(private readonly dispatcher: SpecialistDispatcherPort) {}

  async dispatchBoth(): Promise<PlanDispatchResult> {
    const [branchA, branchB] = await Promise.all([
      this.dispatcher.dispatch('2A'),
      this.dispatcher.dispatch('2B'),
    ]);

    return { branchA, branchB };
  }
}
