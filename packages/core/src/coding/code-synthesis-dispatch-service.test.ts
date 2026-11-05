import { describe, expect, it } from 'vitest';
import type { WorktreeHandle } from '../queue/types.js';
import { CodeSynthesisDispatchService } from './code-synthesis-dispatch-service.js';
import { FakeCodeSynthesisDispatcherPort } from './test-builders.js';
import type { CodingTaskManifest } from './types.js';

const worktree: WorktreeHandle = {
  taskId: 'ORQ-99-example',
  path: '/worktrees/ORQ-99-example',
  branch: 'orq-99-example',
};

const manifest: CodingTaskManifest = {
  coreLogicSpec: [{ path: 'packages/core/src/foo/bar.ts', kind: 'NEW' }],
  testAndBoilerplateSpec: [{ path: 'packages/core/src/foo/bar.test.ts', kind: 'NEW' }],
};

describe('CodeSynthesisDispatchService.dispatchBoth', () => {
  it('dispatches coder_core (2A) and coder_tests (2B) in parallel, scoped to their own manifest', async () => {
    const dispatcher = new FakeCodeSynthesisDispatcherPort((branch) => ({
      branch,
      filesWritten: [`${branch}.ts`],
    }));
    const service = new CodeSynthesisDispatchService(dispatcher);

    const result = await service.dispatchBoth(worktree, manifest);

    expect(result.worktree).toBe(worktree);
    expect(result.branchA).toEqual({ branch: '2A', filesWritten: ['2A.ts'] });
    expect(result.branchB).toEqual({ branch: '2B', filesWritten: ['2B.ts'] });
    expect(dispatcher.calls).toEqual([
      { branch: '2A', worktree, manifest: manifest.coreLogicSpec },
      { branch: '2B', worktree, manifest: manifest.testAndBoilerplateSpec },
    ]);
  });

  it('defaults to an empty filesWritten list when no resolver is given', async () => {
    const dispatcher = new FakeCodeSynthesisDispatcherPort();
    const service = new CodeSynthesisDispatchService(dispatcher);

    const result = await service.dispatchBoth(worktree, manifest);

    expect(result.branchA).toEqual({ branch: '2A', filesWritten: [] });
    expect(result.branchB).toEqual({ branch: '2B', filesWritten: [] });
  });
});
