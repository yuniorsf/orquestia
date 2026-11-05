import type { CodingTaskManifest, DisjointAllocationResult } from './types.js';

/**
 * Validates `coreLogicSpec ∩ testAndBoilerplateSpec = ∅` — the first check
 * of Coding DAG Phase 1, run before any worktree is provisioned.
 */
export class DisjointAllocationValidator {
  validate(manifest: CodingTaskManifest): DisjointAllocationResult {
    const corePaths = new Set(manifest.coreLogicSpec.map((entry) => entry.path));
    const overlapping = manifest.testAndBoilerplateSpec
      .map((entry) => entry.path)
      .filter((path) => corePaths.has(path));

    const findings = overlapping.map((path) => ({
      path,
      message: `File "${path}" is claimed by both coreLogicSpec (2A) and testAndBoilerplateSpec (2B).`,
    }));

    return { valid: findings.length === 0, findings };
  }
}
