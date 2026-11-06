import { PlanDispatchService } from '../planning/plan-dispatch-service.js';
import type { SpecialistDispatcherPort } from '../planning/types.js';
import type { OrchestrationResult, OrchestrationTopologyPort } from './types.js';

/**
 * Default orchestration architecture — today's fixed 2A/2B dispatch,
 * exposed behind {@link OrchestrationTopologyPort}. Delegates to the
 * existing, already-tested {@link PlanDispatchService} rather than
 * duplicating its parallel-dispatch/join logic, so this is a pure
 * additive seam: zero change to current dispatch behavior.
 */
export class FixedTriPlanarTopology implements OrchestrationTopologyPort {
  readonly architecture = 'fixed_tri_planar';

  private readonly dispatchService: PlanDispatchService;

  constructor(dispatcher: SpecialistDispatcherPort) {
    this.dispatchService = new PlanDispatchService(dispatcher);
  }

  async dispatch(): Promise<OrchestrationResult> {
    const { branchA, branchB } = await this.dispatchService.dispatchBoth();

    return {
      outputs: new Map([
        ['2A', branchA],
        ['2B', branchB],
      ]),
    };
  }
}
