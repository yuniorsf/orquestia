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

  it('exports the Phase 3/4 oracle and self-healing services, and their adapters', () => {
    expect(coding.CodingOracleRunner).toBeTypeOf('function');
    expect(coding.CodingSelfHealingService).toBeTypeOf('function');
    expect(coding.ShellCommandRunner).toBeTypeOf('function');
    expect(coding.GitStashCheckpoint).toBeTypeOf('function');
  });

  it('exports the self-healing domain error type', () => {
    expect(coding.InvalidCodingSelfHealConfigError).toBeTypeOf('function');
  });

  it('exports the Phase 5 rebase/reverify and ship services', () => {
    expect(coding.RebaseAndReverifyService).toBeTypeOf('function');
    expect(coding.ShipService).toBeTypeOf('function');
  });

  it('exports the ship domain error type', () => {
    expect(coding.UnverifiedCodeError).toBeTypeOf('function');
  });
});
