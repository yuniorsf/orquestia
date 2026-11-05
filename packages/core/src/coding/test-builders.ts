import type { FileManifestEntry, SpecialistBranch } from '../planning/types.js';
import type { WorktreeHandle } from '../queue/types.js';
import type { CodeSynthesisDispatcherPort, CodeSynthesisOutput } from './types.js';

export class FakeCodeSynthesisDispatcherPort implements CodeSynthesisDispatcherPort {
  readonly calls: Array<{
    branch: SpecialistBranch;
    worktree: WorktreeHandle;
    manifest: readonly FileManifestEntry[];
  }> = [];

  constructor(
    private readonly resolve: (branch: SpecialistBranch) => CodeSynthesisOutput = (branch) => ({
      branch,
      filesWritten: [],
    }),
  ) {}

  async synthesize(
    branch: SpecialistBranch,
    worktree: WorktreeHandle,
    manifest: readonly FileManifestEntry[],
  ): Promise<CodeSynthesisOutput> {
    this.calls.push({ branch, worktree, manifest });
    return this.resolve(branch);
  }
}
