import { describe, expect, it } from 'vitest';
import { PlanOracleEvaluator } from './plan-oracle-evaluator.js';
import { InMemoryFileExistencePort, cleanGitStatus } from './test-builders.js';
import type { GuardrailPattern, PlanOracleInput, SpecialistOutput } from './types.js';

const guardrails: readonly GuardrailPattern[] = [
  { pattern: 'Date\\.now\\(\\)', message: 'Direct wall-clock access is banned; inject a Clock.' },
];

const domainCoreDirs = ['src/core', 'src/domain'];
const forbiddenCoreImports = ['axios'];

function cleanBranchA(overrides: Partial<SpecialistOutput> = {}): SpecialistOutput {
  return {
    branch: '2A',
    fileManifest: [{ path: 'src/core/widget.ts', kind: 'NEW' }],
    codeSnippets: ['export class Widget {}'],
    ...overrides,
  };
}

function cleanBranchB(overrides: Partial<SpecialistOutput> = {}): SpecialistOutput {
  return {
    branch: '2B',
    fileManifest: [{ path: 'src/core/widget.test.ts', kind: 'NEW' }],
    codeSnippets: ["import { Widget } from './widget.js';"],
    ...overrides,
  };
}

function createInput(overrides: Partial<PlanOracleInput> = {}): PlanOracleInput {
  return {
    baselineGitStatus: cleanGitStatus,
    currentGitStatus: cleanGitStatus,
    branchA: cleanBranchA(),
    branchB: cleanBranchB(),
    guardrailPatterns: guardrails,
    domainCoreDirs,
    forbiddenCoreImports,
    ...overrides,
  };
}

function createEvaluator(existingPaths: readonly string[] = []) {
  return new PlanOracleEvaluator(new InMemoryFileExistencePort(new Set(existingPaths)));
}

describe('PlanOracleEvaluator.evaluate — happy path', () => {
  it('passes with zero findings when every gate is satisfied', async () => {
    const evaluator = createEvaluator();

    const result = await evaluator.evaluate(createInput());

    expect(result).toEqual({ passed: true, findings: [] });
  });
});

describe('PlanOracleEvaluator.evaluate — Gate 0 (zero-mutation)', () => {
  it('flags a changed HEAD sha', async () => {
    const evaluator = createEvaluator();

    const result = await evaluator.evaluate(
      createInput({ currentGitStatus: { ...cleanGitStatus, headSha: 'def5678' } }),
    );

    expect(result.passed).toBe(false);
    expect(result.findings).toContainEqual(
      expect.objectContaining({ gate: 2, message: expect.stringContaining('Zero-mutation') }),
    );
  });

  it('flags a changed porcelain status', async () => {
    const evaluator = createEvaluator();

    const result = await evaluator.evaluate(
      createInput({
        currentGitStatus: { ...cleanGitStatus, porcelain: ' M foo.ts\n', isClean: false },
      }),
    );

    expect(result.findings.some((finding) => finding.gate === 2)).toBe(true);
  });
});

describe('PlanOracleEvaluator.evaluate — Gate 1 (disjoint scope)', () => {
  it('flags a file path claimed by both branches', async () => {
    const evaluator = createEvaluator();
    const sharedPath = 'src/core/widget.ts';

    const result = await evaluator.evaluate(
      createInput({
        branchA: cleanBranchA({ fileManifest: [{ path: sharedPath, kind: 'NEW' }] }),
        branchB: cleanBranchB({ fileManifest: [{ path: sharedPath, kind: 'NEW' }] }),
      }),
    );

    expect(result.findings).toContainEqual(
      expect.objectContaining({ gate: 10, message: expect.stringContaining('claimed by both') }),
    );
  });

  it('flags a [MODIFY] entry whose file does not exist on disk', async () => {
    const evaluator = createEvaluator(); // no existing paths

    const result = await evaluator.evaluate(
      createInput({
        branchA: cleanBranchA({ fileManifest: [{ path: 'src/core/missing.ts', kind: 'MODIFY' }] }),
      }),
    );

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        gate: 10,
        message: expect.stringContaining('does not exist on disk'),
      }),
    );
  });

  it('accepts a [MODIFY] entry whose file exists on disk', async () => {
    const evaluator = createEvaluator(['src/core/widget.ts']);

    const result = await evaluator.evaluate(
      createInput({
        branchA: cleanBranchA({ fileManifest: [{ path: 'src/core/widget.ts', kind: 'MODIFY' }] }),
        branchB: cleanBranchB({ fileManifest: [] }),
      }),
    );

    expect(result.findings.some((finding) => finding.gate === 10)).toBe(false);
  });
});

describe('PlanOracleEvaluator.evaluate — Gate 2 (static guardrails)', () => {
  it('flags a banned API pattern in either branch', async () => {
    const evaluator = createEvaluator();

    const result = await evaluator.evaluate(
      createInput({ branchA: cleanBranchA({ codeSnippets: ['const now = Date.now();'] }) }),
    );

    expect(result.findings).toContainEqual(
      expect.objectContaining({ gate: 20, message: expect.stringContaining('Branch 2A') }),
    );
  });

  it('passes clean code through the guardrail gate', async () => {
    const evaluator = createEvaluator();

    const result = await evaluator.evaluate(createInput());

    expect(result.findings.some((finding) => finding.gate === 20)).toBe(false);
  });
});

describe('PlanOracleEvaluator.evaluate — Gate 3 (layer isolation & coverage matrix)', () => {
  it('flags a forbidden import inside a domain-core file', async () => {
    const evaluator = createEvaluator();

    const result = await evaluator.evaluate(
      createInput({
        branchA: cleanBranchA({ codeSnippets: ["import axios from 'axios';"] }),
      }),
    );

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        gate: 30,
        message: expect.stringContaining('must not import "axios"'),
      }),
    );
  });

  it('ignores forbidden-import text outside any domain-core file', async () => {
    const evaluator = createEvaluator();

    const result = await evaluator.evaluate(
      createInput({
        branchA: cleanBranchA({
          fileManifest: [{ path: 'packages/cli/src/index.ts', kind: 'NEW' }],
          codeSnippets: ["import axios from 'axios';"],
        }),
        branchB: cleanBranchB({
          fileManifest: [{ path: 'packages/cli/src/index.test.ts', kind: 'NEW' }],
        }),
      }),
    );

    expect(result.findings.some((finding) => finding.gate === 30)).toBe(false);
  });

  it('flags a 2A source file with no matching test in the 2B manifest', async () => {
    const evaluator = createEvaluator();

    const result = await evaluator.evaluate(
      createInput({ branchB: cleanBranchB({ fileManifest: [] }) }),
    );

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        gate: 30,
        message: expect.stringContaining('No test coverage planned'),
      }),
    );
  });

  it('does not require coverage for barrel (index.ts) files', async () => {
    const evaluator = createEvaluator();

    const result = await evaluator.evaluate(
      createInput({
        branchA: cleanBranchA({ fileManifest: [{ path: 'src/core/index.ts', kind: 'NEW' }] }),
        branchB: cleanBranchB({ fileManifest: [] }),
      }),
    );

    expect(result.findings.some((finding) => finding.gate === 30)).toBe(false);
  });
});
