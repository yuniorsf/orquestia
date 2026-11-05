import { describe, expect, it } from 'vitest';
import { PlanDispatchService } from './plan-dispatch-service.js';
import { FakeSpecialistDispatcherPort } from './test-builders.js';
import type { SpecialistOutput } from './types.js';

const branchAOutput: SpecialistOutput = {
  branch: '2A',
  fileManifest: [{ path: 'packages/core/src/foo/bar.ts', kind: 'NEW' }],
  codeSnippets: ['export class Bar {}'],
};

const branchBOutput: SpecialistOutput = {
  branch: '2B',
  fileManifest: [{ path: 'packages/core/src/foo/bar.test.ts', kind: 'NEW' }],
  codeSnippets: ["import { Bar } from './bar.js';"],
};

describe('PlanDispatchService.dispatchBoth', () => {
  it('dispatches both branches and joins on their structured outputs', async () => {
    const dispatcher = new FakeSpecialistDispatcherPort({
      '2A': branchAOutput,
      '2B': branchBOutput,
    });
    const service = new PlanDispatchService(dispatcher);

    const result = await service.dispatchBoth();

    expect(result.branchA).toEqual(branchAOutput);
    expect(result.branchB).toEqual(branchBOutput);
    expect(dispatcher.dispatchedBranches.sort()).toEqual(['2A', '2B']);
  });
});
