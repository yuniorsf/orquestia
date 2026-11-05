import type { FileManifestEntry, SpecialistBranch } from '../planning/types.js';
import type { WorktreeHandle } from '../queue/types.js';

/**
 * Coding DAG Phase 1 input: the disjoint file allocations for `coder_core`
 * (Branch 2A: domain models, algorithms, ports) and `coder_tests` (Branch
 * 2B: DTOs, mocks, and the full unit test suite).
 */
export interface CodingTaskManifest {
  readonly coreLogicSpec: readonly FileManifestEntry[];
  readonly testAndBoilerplateSpec: readonly FileManifestEntry[];
}

export interface DisjointAllocationFinding {
  readonly path: string;
  readonly message: string;
}

export interface DisjointAllocationResult {
  readonly valid: boolean;
  readonly findings: readonly DisjointAllocationFinding[];
}

export class DisjointAllocationError extends Error {
  constructor(findings: readonly DisjointAllocationFinding[]) {
    super(
      `Disjoint file allocation violated (coreLogicSpec ∩ testAndBoilerplateSpec ≠ ∅): ${findings
        .map((finding) => finding.path)
        .join(', ')}`,
    );
    this.name = 'DisjointAllocationError';
  }
}

export interface CodeSynthesisOutput {
  readonly branch: SpecialistBranch;
  readonly filesWritten: readonly string[];
}

export interface CodeSynthesisDispatcherPort {
  synthesize(
    branch: SpecialistBranch,
    worktree: WorktreeHandle,
    manifest: readonly FileManifestEntry[],
  ): Promise<CodeSynthesisOutput>;
}

export interface CodeSynthesisResult {
  readonly worktree: WorktreeHandle;
  readonly branchA: CodeSynthesisOutput;
  readonly branchB: CodeSynthesisOutput;
}
