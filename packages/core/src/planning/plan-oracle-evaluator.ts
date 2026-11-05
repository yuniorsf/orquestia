import type {
  FileExistencePort,
  GateFinding,
  GuardrailPattern,
  PlanOracleInput,
  PlanOracleResult,
  SpecialistOutput,
} from './types.js';

/**
 * Phase 3 of the Planning DAG: the Deterministic Plan Oracle. Evaluates the
 * combined Branch 2A + 2B outputs against Gate 0 (zero-mutation), Gate 1
 * (path verification & disjoint file scope), Gate 2 (static guardrails &
 * banned symbols), and Gate 3 (layer isolation & test coverage matrix).
 */
export class PlanOracleEvaluator {
  constructor(private readonly fileExistencePort: FileExistencePort) {}

  async evaluate(input: PlanOracleInput): Promise<PlanOracleResult> {
    const findings: GateFinding[] = [
      ...evaluateZeroMutationGate(input.baselineGitStatus, input.currentGitStatus),
      ...(await evaluateDisjointScopeGate(input.branchA, input.branchB, this.fileExistencePort)),
      ...evaluateGuardrailGate(input.branchA, input.branchB, input.guardrailPatterns),
      ...evaluateLayerIsolationGate(
        input.branchA,
        input.branchB,
        input.domainCoreDirs,
        input.forbiddenCoreImports,
      ),
    ];

    return { passed: findings.length === 0, findings };
  }
}

function evaluateZeroMutationGate(
  baseline: PlanOracleInput['baselineGitStatus'],
  current: PlanOracleInput['currentGitStatus'],
): GateFinding[] {
  if (baseline.headSha === current.headSha && baseline.porcelain === current.porcelain) {
    return [];
  }
  return [
    {
      gate: 2,
      message:
        'Zero-mutation invariant violated: workspace git status changed during read-only dispatch.',
    },
  ];
}

async function evaluateDisjointScopeGate(
  branchA: SpecialistOutput,
  branchB: SpecialistOutput,
  fileExistencePort: FileExistencePort,
): Promise<GateFinding[]> {
  const findings: GateFinding[] = [];
  const pathsA = new Set(branchA.fileManifest.map((entry) => entry.path));
  const overlapping = branchB.fileManifest
    .map((entry) => entry.path)
    .filter((path) => pathsA.has(path));

  for (const path of overlapping) {
    findings.push({
      gate: 10,
      message: `File "${path}" is claimed by both Branch 2A and Branch 2B (2A ∩ 2B ≠ ∅).`,
    });
  }

  const modifyEntries = [...branchA.fileManifest, ...branchB.fileManifest].filter(
    (entry) => entry.kind === 'MODIFY',
  );
  for (const entry of modifyEntries) {
    const exists = await fileExistencePort.exists(entry.path);
    if (!exists) {
      findings.push({ gate: 10, message: `[MODIFY] file "${entry.path}" does not exist on disk.` });
    }
  }

  return findings;
}

function evaluateGuardrailGate(
  branchA: SpecialistOutput,
  branchB: SpecialistOutput,
  patterns: readonly GuardrailPattern[],
): GateFinding[] {
  const findings: GateFinding[] = [];
  for (const output of [branchA, branchB]) {
    for (const snippet of output.codeSnippets) {
      for (const guardrail of patterns) {
        if (new RegExp(guardrail.pattern).test(snippet)) {
          findings.push({ gate: 20, message: `Branch ${output.branch}: ${guardrail.message}` });
        }
      }
    }
  }
  return findings;
}

function evaluateLayerIsolationGate(
  branchA: SpecialistOutput,
  branchB: SpecialistOutput,
  domainCoreDirs: readonly string[],
  forbiddenCoreImports: readonly string[],
): GateFinding[] {
  return [
    ...evaluateForbiddenImports(branchA, domainCoreDirs, forbiddenCoreImports),
    ...evaluateForbiddenImports(branchB, domainCoreDirs, forbiddenCoreImports),
    ...evaluateCoverageMatrix(branchA, branchB),
  ];
}

function evaluateForbiddenImports(
  output: SpecialistOutput,
  domainCoreDirs: readonly string[],
  forbiddenCoreImports: readonly string[],
): GateFinding[] {
  const touchesDomainCore = output.fileManifest.some((entry) =>
    isInDomainCore(entry.path, domainCoreDirs),
  );
  if (!touchesDomainCore) {
    return [];
  }

  const findings: GateFinding[] = [];
  for (const snippet of output.codeSnippets) {
    for (const forbidden of forbiddenCoreImports) {
      if (snippet.includes(forbidden)) {
        findings.push({
          gate: 30,
          message: `Branch ${output.branch}: domain core must not import "${forbidden}".`,
        });
      }
    }
  }
  return findings;
}

function isInDomainCore(path: string, domainCoreDirs: readonly string[]): boolean {
  return domainCoreDirs.some(
    (dir) => path === dir || path.startsWith(`${dir}/`) || path.includes(`/${dir}/`),
  );
}

function evaluateCoverageMatrix(
  branchA: SpecialistOutput,
  branchB: SpecialistOutput,
): GateFinding[] {
  const testPaths = new Set(branchB.fileManifest.map((entry) => entry.path));
  const findings: GateFinding[] = [];

  for (const entry of branchA.fileManifest) {
    if (!isTestableSourceFile(entry.path)) {
      continue;
    }
    const expectedTestPath = toTestPath(entry.path);
    if (!testPaths.has(expectedTestPath)) {
      findings.push({
        gate: 30,
        message: `No test coverage planned for "${entry.path}" (expected "${expectedTestPath}" in Branch 2B's manifest).`,
      });
    }
  }
  return findings;
}

function isTestableSourceFile(path: string): boolean {
  return path.endsWith('.ts') && !path.endsWith('.test.ts') && !path.endsWith('index.ts');
}

function toTestPath(path: string): string {
  return path.replace(/\.ts$/, '.test.ts');
}
