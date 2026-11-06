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

  it('exports the real agent-backed synthesis/remediation dispatchers, the fs file writer, and the synthesis domain error', () => {
    expect(coding.AgentCodeSynthesisDispatcher).toBeTypeOf('function');
    expect(coding.AgentCodingRemediationDispatcher).toBeTypeOf('function');
    expect(coding.FsFileWriter).toBeTypeOf('function');
    expect(coding.MalformedSynthesisOutputError).toBeTypeOf('function');
  });
});
