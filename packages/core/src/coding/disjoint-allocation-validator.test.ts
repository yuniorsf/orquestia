import { describe, expect, it } from 'vitest';
import { DisjointAllocationValidator } from './disjoint-allocation-validator.js';
import type { CodingTaskManifest } from './types.js';

describe('DisjointAllocationValidator.validate', () => {
  it('is valid when coreLogicSpec and testAndBoilerplateSpec share no paths', () => {
    const manifest: CodingTaskManifest = {
      coreLogicSpec: [{ path: 'packages/core/src/foo/bar.ts', kind: 'NEW' }],
      testAndBoilerplateSpec: [{ path: 'packages/core/src/foo/bar.test.ts', kind: 'NEW' }],
    };

    const result = new DisjointAllocationValidator().validate(manifest);

    expect(result).toEqual({ valid: true, findings: [] });
  });

  it('is valid when either spec is empty', () => {
    const manifest: CodingTaskManifest = { coreLogicSpec: [], testAndBoilerplateSpec: [] };

    expect(new DisjointAllocationValidator().validate(manifest).valid).toBe(true);
  });

  it('flags a path claimed by both specs', () => {
    const sharedPath = 'packages/core/src/foo/bar.ts';
    const manifest: CodingTaskManifest = {
      coreLogicSpec: [{ path: sharedPath, kind: 'NEW' }],
      testAndBoilerplateSpec: [{ path: sharedPath, kind: 'NEW' }],
    };

    const result = new DisjointAllocationValidator().validate(manifest);

    expect(result.valid).toBe(false);
    expect(result.findings).toEqual([
      {
        path: sharedPath,
        message: `File "${sharedPath}" is claimed by both coreLogicSpec (2A) and testAndBoilerplateSpec (2B).`,
      },
    ]);
  });

  it('flags every overlapping path', () => {
    const manifest: CodingTaskManifest = {
      coreLogicSpec: [
        { path: 'a.ts', kind: 'NEW' },
        { path: 'b.ts', kind: 'NEW' },
      ],
      testAndBoilerplateSpec: [
        { path: 'a.ts', kind: 'NEW' },
        { path: 'b.ts', kind: 'NEW' },
        { path: 'c.test.ts', kind: 'NEW' },
      ],
    };

    const result = new DisjointAllocationValidator().validate(manifest);

    expect(result.findings.map((finding) => finding.path)).toEqual(['a.ts', 'b.ts']);
  });
});
