import type { WorktreeHandle } from '../queue/types.js';
import type {
  CodeSynthesisDispatcherPort,
  CodeSynthesisResult,
  CodingTaskManifest,
} from './types.js';

/**
 * Coding DAG Phase 2: dispatches `coder_core` (Branch 2A) and `coder_tests`
 * (Branch 2B) in parallel inside the provisioned worktree and joins on
 * their structured outputs.
 */
export class CodeSynthesisDispatchService {
  constructor(private readonly dispatcher: CodeSynthesisDispatcherPort) {}

  async dispatchBoth(
    worktree: WorktreeHandle,
    manifest: CodingTaskManifest,
  ): Promise<CodeSynthesisResult> {
    const [branchA, branchB] = await Promise.all([
      this.dispatcher.synthesize('2A', worktree, manifest.coreLogicSpec),
      this.dispatcher.synthesize('2B', worktree, manifest.testAndBoilerplateSpec),
    ]);

    return { worktree, branchA, branchB };
  }
}
