import { describe, expect, it } from 'vitest';
import * as coding from './index.js';

describe('coding public API', () => {
  it('exports the Phase 1/2 services', () => {
    expect(coding.DisjointAllocationValidator).toBeTypeOf('function');
    expect(coding.CodingTaskProvisioningService).toBeTypeOf('function');
    expect(coding.CodeSynthesisDispatchService).toBeTypeOf('function');
  });

  it('exports the disjoint allocation domain error type', () => {
    expect(coding.DisjointAllocationError).toBeTypeOf('function');
  });
});
