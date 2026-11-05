import type { PlanOracleEvaluator } from './plan-oracle-evaluator.js';
import {
  InvalidSelfHealConfigError,
  type GateFinding,
  type PlanOracleInput,
  type PlanOracleResult,
  type RemediationDispatcherPort,
  type SelfHealAttempt,
  type SelfHealConfig,
  type SelfHealOutcome,
  type SelfHealOutcomeStatus,
  type SpecialistBranch,
  type SpecialistOutput,
} from './types.js';

/**
 * Phase 4 of the Planning DAG: a bounded self-healing loop. On a failing
 * Deterministic Plan Oracle result (Gate 10/20/30), routes remediation back
 * to Branch 2A and/or 2B and re-evaluates, up to `maxRetries` times. A Gate 0
 * (code 2, zero-mutation) failure aborts immediately — it is never retried.
 */
export class PlanningSelfHealingService {
  constructor(
    private readonly oracleEvaluator: PlanOracleEvaluator,
    private readonly remediationDispatcher: RemediationDispatcherPort,
    private readonly config: SelfHealConfig,
  ) {
    if (config.maxRetries < 0) {
      throw new InvalidSelfHealConfigError('maxRetries must be zero or greater.');
    }
  }

  async run(initialInput: PlanOracleInput): Promise<SelfHealOutcome> {
    const attempts: SelfHealAttempt[] = [];
    let currentInput = initialInput;
    let result = await this.oracleEvaluator.evaluate(currentInput);
    attempts.push({ attempt: 0, result });

    let healAttempt = 1;
    while (
      !result.passed &&
      !hasZeroMutationFailure(result) &&
      healAttempt <= this.config.maxRetries
    ) {
      const branches = branchesToRemediate(result.findings);
      const updates = await remediateBranches(
        this.remediationDispatcher,
        branches,
        result.findings,
      );
      currentInput = { ...currentInput, ...updates };

      result = await this.oracleEvaluator.evaluate(currentInput);
      attempts.push({ attempt: healAttempt, result });
      healAttempt += 1;
    }

    return { status: resolveStatus(result), finalResult: result, attempts };
  }
}

function hasZeroMutationFailure(result: PlanOracleResult): boolean {
  return result.findings.some((finding) => finding.gate === 2);
}

function resolveStatus(result: PlanOracleResult): SelfHealOutcomeStatus {
  if (result.passed) {
    return 'passed';
  }
  return hasZeroMutationFailure(result) ? 'aborted' : 'exhausted';
}

function branchesToRemediate(findings: readonly GateFinding[]): SpecialistBranch[] {
  const codes = new Set(findings.map((finding) => finding.gate));
  const branches = new Set<SpecialistBranch>();

  if (codes.has(10)) {
    branches.add('2B');
  }
  if (codes.has(20)) {
    branches.add('2A');
  }
  if (codes.has(30)) {
    branches.add('2A');
    branches.add('2B');
  }

  return [...branches];
}

interface BranchUpdates {
  branchA?: SpecialistOutput;
  branchB?: SpecialistOutput;
}

async function remediateBranches(
  dispatcher: RemediationDispatcherPort,
  branches: readonly SpecialistBranch[],
  findings: readonly GateFinding[],
): Promise<BranchUpdates> {
  const updates: BranchUpdates = {};

  await Promise.all(
    branches.map(async (branch) => {
      const output = await dispatcher.remediate(branch, findings);
      if (branch === '2A') {
        updates.branchA = output;
      } else {
        updates.branchB = output;
      }
    }),
  );

  return updates;
}
