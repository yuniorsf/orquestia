import type {
  ManifestConflictRemediationDispatcherPort,
  SpecialistOutput,
} from '../planning/types.js';
import { DisjointAllocationValidator } from './disjoint-allocation-validator.js';
import type { CodingTaskManifest } from './types.js';

export interface ManifestConflictHealConfig {
  readonly maxRetries: number;
}

export type ManifestConflictHealStatus = 'passed' | 'exhausted';

export interface ManifestConflictOutcome {
  readonly status: ManifestConflictHealStatus;
  readonly branchA: SpecialistOutput;
  readonly branchB: SpecialistOutput;
  readonly attempts: number;
}

function toManifest(branchA: SpecialistOutput, branchB: SpecialistOutput): CodingTaskManifest {
  return { coreLogicSpec: branchA.fileManifest, testAndBoilerplateSpec: branchB.fileManifest };
}

/**
 * Coding DAG Phase 1 addendum (ORQ-49), run between
 * `PlanDispatchService.dispatchBoth()` and handing the manifest to
 * `CodingTaskProvisioningService.provision()`. Branch 2A and 2B decide
 * their manifests independently and in parallel, with no visibility into
 * each other's claims — for a task whose natural shape has only one
 * sensible place to change, both routinely converge on the same file. This
 * gives 2B a bounded number of informed retries (explicitly told which
 * paths 2A already claimed) before falling through to the existing
 * `DisjointAllocationError` behavior, unchanged, if still exhausted.
 */
export class ManifestConflictSelfHealingService {
  private readonly validator = new DisjointAllocationValidator();

  constructor(
    private readonly dispatcher: ManifestConflictRemediationDispatcherPort,
    private readonly config: ManifestConflictHealConfig,
  ) {}

  async run(
    branchA: SpecialistOutput,
    initialBranchB: SpecialistOutput,
  ): Promise<ManifestConflictOutcome> {
    let branchB = initialBranchB;
    let result = this.validator.validate(toManifest(branchA, branchB));
    let attempt = 0;

    while (!result.valid && attempt < this.config.maxRetries) {
      const overlappingPaths = result.findings.map((finding) => finding.path);
      branchB = await this.dispatcher.remediate(overlappingPaths);
      result = this.validator.validate(toManifest(branchA, branchB));
      attempt += 1;
    }

    return { status: result.valid ? 'passed' : 'exhausted', branchA, branchB, attempts: attempt };
  }
}
