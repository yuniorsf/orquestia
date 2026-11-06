import type {
  ConfigReaderPort,
  FileExistencePort,
  GitStatusPort,
  GuardrailPattern,
  OrquestiaConfig,
  SpecialistDispatcherPort,
  SpecialistOutput,
} from '@orquestia/core';
import { PlanDispatchService, PlanOracleEvaluator } from '@orquestia/core';
import type { CliCommand, CommandResult } from './types.js';

export type SpecialistDispatcherFactory = (taskId: string) => SpecialistDispatcherPort;

interface PlanOracleSettings {
  readonly guardrailPatterns: readonly GuardrailPattern[];
  readonly domainCoreDirs: readonly string[];
  readonly forbiddenCoreImports: readonly string[];
}

const EMPTY_ORACLE_SETTINGS: PlanOracleSettings = {
  guardrailPatterns: [],
  domainCoreDirs: [],
  forbiddenCoreImports: [],
};

/** Reads the optional `plan_oracle:` section of orquestia.config.yaml; absent/malformed fields default to []. */
function readPlanOracleSettings(raw: Readonly<Record<string, unknown>>): PlanOracleSettings {
  const section = raw.plan_oracle;
  if (typeof section !== 'object' || section === null || Array.isArray(section)) {
    return EMPTY_ORACLE_SETTINGS;
  }
  const settings = section as Record<string, unknown>;

  return {
    guardrailPatterns: Array.isArray(settings.guardrail_patterns)
      ? (settings.guardrail_patterns as GuardrailPattern[])
      : [],
    domainCoreDirs: Array.isArray(settings.domain_core_dirs)
      ? (settings.domain_core_dirs as string[])
      : [],
    forbiddenCoreImports: Array.isArray(settings.forbidden_core_imports)
      ? (settings.forbidden_core_imports as string[])
      : [],
  };
}

function formatManifest(entries: readonly SpecialistOutput['fileManifest'][number][]): string {
  if (entries.length === 0) {
    return '  (none)\n';
  }
  return entries.map((entry) => `  [${entry.kind}] ${entry.path}\n`).join('');
}

/**
 * `orquestia plan <taskId>` — the read-only Phase 1-3 slice of the
 * Planning DAG (baseline snapshot, parallel 2A/2B specialist dispatch,
 * Deterministic Plan Oracle evaluation). Prints a human-readable report
 * to stdout and never writes to disk; Phase 4 (self-healing retries) and
 * Phase 5 (spec synthesis + Confluence/Jira sync, which need the ALM
 * auth wiring tracked in ORQ-36) are out of scope.
 */
export class PlanCommand implements CliCommand {
  readonly name = 'plan';
  readonly summary = 'Run the Planning DAG (architecture spec synthesis)';

  constructor(
    private readonly gitStatusPort: GitStatusPort,
    private readonly configReaderPort: ConfigReaderPort,
    private readonly fileExistencePort: FileExistencePort,
    private readonly dispatcherFactory: SpecialistDispatcherFactory,
  ) {}

  async run(args: readonly string[]): Promise<CommandResult> {
    const [taskId] = args;
    if (!taskId) {
      return { exitCode: 1, stdout: '', stderr: 'Usage: orquestia plan <taskId>\n' };
    }

    const baselineGitStatus = await this.gitStatusPort.captureBaseline();
    const config = await this.loadConfigOrDefault();

    const dispatcher = this.dispatcherFactory(taskId);
    let branchA: SpecialistOutput;
    let branchB: SpecialistOutput;
    try {
      ({ branchA, branchB } = await new PlanDispatchService(dispatcher).dispatchBoth());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        exitCode: 1,
        stdout: '',
        stderr: `Specialist dispatch failed for "${taskId}": ${message}\n`,
      };
    }

    const currentGitStatus = await this.gitStatusPort.captureBaseline();
    const settings = readPlanOracleSettings(config.raw);
    const result = await new PlanOracleEvaluator(this.fileExistencePort).evaluate({
      baselineGitStatus,
      currentGitStatus,
      branchA,
      branchB,
      ...settings,
    });

    const lines = [
      `Plan: ${taskId}`,
      '',
      'Branch 2A — Architecture & Domain File Manifest:',
      formatManifest(branchA.fileManifest).trimEnd(),
      '',
      'Branch 2B — Contracts & Test File Manifest:',
      formatManifest(branchB.fileManifest).trimEnd(),
      '',
      result.passed
        ? 'Deterministic Plan Oracle: PASSED (0 findings).'
        : `Deterministic Plan Oracle: FAILED (${result.findings.length} finding(s)):`,
      ...result.findings.map((finding) => `  [Gate ${finding.gate}] ${finding.message}`),
    ];

    return { exitCode: result.passed ? 0 : 2, stdout: `${lines.join('\n')}\n`, stderr: '' };
  }

  private async loadConfigOrDefault(): Promise<OrquestiaConfig> {
    try {
      return await this.configReaderPort.loadConfig();
    } catch {
      return { version: 'unknown', projectName: 'unknown', raw: {} };
    }
  }
}
