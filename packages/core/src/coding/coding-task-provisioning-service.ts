import type { WorktreeHandle, WorktreeProvisioner } from '../queue/types.js';
import type { DisjointAllocationValidator } from './disjoint-allocation-validator.js';
import { DisjointAllocationError, type CodingTaskManifest } from './types.js';

/**
 * Coding DAG Phase 1: validates the disjoint `coreLogicSpec`/
 * `testAndBoilerplateSpec` allocation, then provisions the isolated Git
 * worktree (`../worktrees/<taskId>`) via the shared {@link WorktreeProvisioner}
 * port (ORQ-11). Never provisions a worktree for an invalid allocation.
 */
export class CodingTaskProvisioningService {
  constructor(
    private readonly validator: DisjointAllocationValidator,
    private readonly worktreeProvisioner: WorktreeProvisioner,
  ) {}

  async provision(
    taskId: string,
    baseRef: string,
    manifest: CodingTaskManifest,
  ): Promise<WorktreeHandle> {
    const result = this.validator.validate(manifest);
    if (!result.valid) {
      throw new DisjointAllocationError(result.findings);
    }

    return this.worktreeProvisioner.create(taskId, baseRef);
  }
}
