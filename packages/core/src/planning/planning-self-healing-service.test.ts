import { describe, expect, it } from 'vitest';
import { PlanOracleEvaluator } from './plan-oracle-evaluator.js';
import { PlanningSelfHealingService } from './planning-self-healing-service.js';
import {
  FakeRemediationDispatcherPort,
  InMemoryFileExistencePort,
  cleanGitStatus,
} from './test-builders.js';
import { InvalidSelfHealConfigError } from './types.js';
import type { PlanOracleInput, SpecialistOutput } from './types.js';

function branch(overrides: Partial<SpecialistOutput> & { branch: '2A' | '2B' }): SpecialistOutput {
  return { fileManifest: [], codeSnippets: [], ...overrides };
}

function createInput(overrides: Partial<PlanOracleInput> = {}): PlanOracleInput {
  return {
    baselineGitStatus: cleanGitStatus,
    currentGitStatus: cleanGitStatus,
    branchA: branch({ branch: '2A' }),
    branchB: branch({ branch: '2B' }),
    guardrailPatterns: [],
    domainCoreDirs: [],
    forbiddenCoreImports: [],
    ...overrides,
  };
}

function createEvaluator() {
  return new PlanOracleEvaluator(new InMemoryFileExistencePort(new Set()));
}

describe('PlanningSelfHealingService constructor', () => {
  it('rejects a negative maxRetries', () => {
    const dispatcher = new FakeRemediationDispatcherPort(() => branch({ branch: '2A' }));

    expect(
      () => new PlanningSelfHealingService(createEvaluator(), dispatcher, { maxRetries: -1 }),
    ).toThrow(InvalidSelfHealConfigError);
  });
});

describe('PlanningSelfHealingService.run', () => {
  it('returns "passed" immediately when the first evaluation already passes', async () => {
    const dispatcher = new FakeRemediationDispatcherPort(() => branch({ branch: '2A' }));
    const service = new PlanningSelfHealingService(createEvaluator(), dispatcher, {
      maxRetries: 3,
    });

    const outcome = await service.run(createInput());

    expect(outcome.status).toBe('passed');
    expect(outcome.attempts).toHaveLength(1);
    expect(dispatcher.calls).toHaveLength(0);
  });

  it('returns "aborted" immediately on a zero-mutation (Gate 0) failure, without remediating', async () => {
    const dispatcher = new FakeRemediationDispatcherPort(() => branch({ branch: '2A' }));
    const service = new PlanningSelfHealingService(createEvaluator(), dispatcher, {
      maxRetries: 3,
    });

    const outcome = await service.run(
      createInput({ currentGitStatus: { ...cleanGitStatus, headSha: 'dirty' } }),
    );

    expect(outcome.status).toBe('aborted');
    expect(outcome.attempts).toHaveLength(1);
    expect(dispatcher.calls).toHaveLength(0);
  });

  it('routes a Gate 10 (disjoint scope) failure to Branch 2B only, and succeeds once healed', async () => {
    // A non-source shared path keeps this isolated to Gate 10 (no Gate 30
    // coverage-matrix requirement is implied by a non-`.ts` file).
    const sharedPath = 'README.md';
    const dispatcher = new FakeRemediationDispatcherPort((healBranch) =>
      branch({ branch: healBranch, fileManifest: [] }),
    );
    const service = new PlanningSelfHealingService(createEvaluator(), dispatcher, {
      maxRetries: 3,
    });

    const outcome = await service.run(
      createInput({
        branchA: branch({ branch: '2A', fileManifest: [{ path: sharedPath, kind: 'NEW' }] }),
        branchB: branch({ branch: '2B', fileManifest: [{ path: sharedPath, kind: 'NEW' }] }),
      }),
    );

    expect(outcome.status).toBe('passed');
    expect(outcome.attempts).toHaveLength(2);
    expect(dispatcher.calls.map((call) => call.branch)).toEqual(['2B']);
  });

  it('routes a Gate 20 (guardrail) failure to Branch 2A only', async () => {
    const dispatcher = new FakeRemediationDispatcherPort((healBranch) =>
      branch({ branch: healBranch }),
    );
    const service = new PlanningSelfHealingService(createEvaluator(), dispatcher, {
      maxRetries: 3,
    });

    await service.run(
      createInput({
        branchA: branch({ branch: '2A', codeSnippets: ['Date.now()'] }),
        guardrailPatterns: [{ pattern: 'Date\\.now\\(\\)', message: 'banned' }],
      }),
    );

    expect(dispatcher.calls.map((call) => call.branch)).toEqual(['2A']);
  });

  it('routes a Gate 30 (layer isolation) failure to both Branch 2A and 2B', async () => {
    const dispatcher = new FakeRemediationDispatcherPort((healBranch) =>
      branch({ branch: healBranch }),
    );
    const service = new PlanningSelfHealingService(createEvaluator(), dispatcher, {
      maxRetries: 3,
    });

    await service.run(
      createInput({
        branchA: branch({
          branch: '2A',
          fileManifest: [{ path: 'src/core/widget.ts', kind: 'NEW' }],
          codeSnippets: ["import axios from 'axios';"],
        }),
        domainCoreDirs: ['src/core'],
        forbiddenCoreImports: ['axios'],
      }),
    );

    expect(dispatcher.calls.map((call) => call.branch).sort()).toEqual(['2A', '2B']);
  });

  it('returns "exhausted" after using up all retries while still failing', async () => {
    const dispatcher = new FakeRemediationDispatcherPort((healBranch) =>
      branch({ branch: healBranch, codeSnippets: ['Date.now()'] }),
    );
    const service = new PlanningSelfHealingService(createEvaluator(), dispatcher, {
      maxRetries: 2,
    });

    const outcome = await service.run(
      createInput({
        branchA: branch({ branch: '2A', codeSnippets: ['Date.now()'] }),
        guardrailPatterns: [{ pattern: 'Date\\.now\\(\\)', message: 'banned' }],
      }),
    );

    expect(outcome.status).toBe('exhausted');
    expect(outcome.attempts).toHaveLength(3); // initial + 2 retries
  });

  it('performs a single evaluation with no healing when maxRetries is 0', async () => {
    const dispatcher = new FakeRemediationDispatcherPort((healBranch) =>
      branch({ branch: healBranch }),
    );
    const service = new PlanningSelfHealingService(createEvaluator(), dispatcher, {
      maxRetries: 0,
    });

    const outcome = await service.run(
      createInput({
        branchA: branch({ branch: '2A', codeSnippets: ['Date.now()'] }),
        guardrailPatterns: [{ pattern: 'Date\\.now\\(\\)', message: 'banned' }],
      }),
    );

    expect(outcome.status).toBe('exhausted');
    expect(outcome.attempts).toHaveLength(1);
    expect(dispatcher.calls).toHaveLength(0);
  });
});
