import { describe, expect, it } from 'vitest';
import * as planning from './index.js';

describe('planning public API', () => {
  it('exports the baseline snapshot service and its adapters', () => {
    expect(planning.BaselineSnapshotService).toBeTypeOf('function');
    expect(planning.GitStatusSnapshotter).toBeTypeOf('function');
    expect(planning.YamlConfigReader).toBeTypeOf('function');
  });

  it('exports the config domain error type', () => {
    expect(planning.ConfigValidationError).toBeTypeOf('function');
  });

  it('exports the plan dispatch and oracle evaluator services, and the fs adapter', () => {
    expect(planning.PlanDispatchService).toBeTypeOf('function');
    expect(planning.PlanOracleEvaluator).toBeTypeOf('function');
    expect(planning.FsFileExistencePort).toBeTypeOf('function');
  });

  it('exports the self-healing and synthesis services, and the spec writer adapter', () => {
    expect(planning.PlanningSelfHealingService).toBeTypeOf('function');
    expect(planning.PlanSynthesisService).toBeTypeOf('function');
    expect(planning.FsPlanSpecWriter).toBeTypeOf('function');
  });

  it('exports the self-healing and synthesis domain error types', () => {
    expect(planning.InvalidSelfHealConfigError).toBeTypeOf('function');
    expect(planning.UnverifiedPlanError).toBeTypeOf('function');
  });

  it('exports the real agent-backed specialist dispatcher and its domain error', () => {
    expect(planning.AgentSpecialistDispatcher).toBeTypeOf('function');
    expect(planning.MalformedSpecialistOutputError).toBeTypeOf('function');
  });
});
