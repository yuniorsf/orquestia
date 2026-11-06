import { describe, expect, it } from 'vitest';
import { FakeSpecialistDispatcherPort } from '../planning/test-builders.js';
import type { SpecialistOutput } from '../planning/types.js';
import { FixedTriPlanarTopology } from './fixed-tri-planar-topology.js';

const branchAOutput: SpecialistOutput = {
  branch: '2A',
  fileManifest: [{ kind: 'NEW', path: 'src/core/a.ts' }],
  codeSnippets: [],
};
const branchBOutput: SpecialistOutput = {
  branch: '2B',
  fileManifest: [{ kind: 'NEW', path: 'src/core/a.test.ts' }],
  codeSnippets: [],
};

describe('FixedTriPlanarTopology', () => {
  it('reports its architecture name', () => {
    const dispatcher = new FakeSpecialistDispatcherPort({
      '2A': branchAOutput,
      '2B': branchBOutput,
    });

    expect(new FixedTriPlanarTopology(dispatcher).architecture).toBe('fixed_tri_planar');
  });

  it('dispatches both 2A and 2B and joins them into the generalized outputs map, preserving current behavior', async () => {
    const dispatcher = new FakeSpecialistDispatcherPort({
      '2A': branchAOutput,
      '2B': branchBOutput,
    });
    const topology = new FixedTriPlanarTopology(dispatcher);

    const result = await topology.dispatch();

    expect(dispatcher.dispatchedBranches).toEqual(['2A', '2B']);
    expect(result.outputs.get('2A')).toBe(branchAOutput);
    expect(result.outputs.get('2B')).toBe(branchBOutput);
    expect(result.outputs.size).toBe(2);
  });
});
