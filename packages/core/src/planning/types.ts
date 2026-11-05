export interface BaselineGitStatus {
  readonly porcelain: string;
  readonly headSha: string;
  readonly isClean: boolean;
}

export interface GitStatusPort {
  captureBaseline(): Promise<BaselineGitStatus>;
}

export interface OrquestiaConfig {
  readonly version: string;
  readonly projectName: string;
  readonly raw: Readonly<Record<string, unknown>>;
}

export interface ConfigReaderPort {
  loadConfig(): Promise<OrquestiaConfig>;
}

export interface IssueDetails {
  readonly key: string;
  readonly summary: string;
  readonly status: string;
  readonly blockedByKeys: readonly string[];
}

export interface IssueTrackerPort {
  getIssue(issueKey: string): Promise<IssueDetails>;
}

export interface PlanningBaseline {
  readonly gitStatus: BaselineGitStatus;
  readonly config: OrquestiaConfig;
  readonly issue: IssueDetails | null;
}

export class ConfigValidationError extends Error {
  constructor(filePath: string, reason: string) {
    super(`Invalid orquestia config at "${filePath}": ${reason}`);
    this.name = 'ConfigValidationError';
  }
}

export type SpecialistBranch = '2A' | '2B';

export type FileManifestKind = 'NEW' | 'MODIFY';

export interface FileManifestEntry {
  readonly path: string;
  readonly kind: FileManifestKind;
}

export interface SpecialistOutput {
  readonly branch: SpecialistBranch;
  readonly fileManifest: readonly FileManifestEntry[];
  readonly codeSnippets: readonly string[];
}

export interface SpecialistDispatcherPort {
  dispatch(branch: SpecialistBranch): Promise<SpecialistOutput>;
}

export interface FileExistencePort {
  exists(path: string): Promise<boolean>;
}

export interface GuardrailPattern {
  readonly pattern: string;
  readonly message: string;
}

/** Deterministic Plan Oracle gate codes, per ORQUESTIA_SPECIFICATION.md §3.1. */
export type GateCode = 2 | 10 | 20 | 30;

export interface GateFinding {
  readonly gate: GateCode;
  readonly message: string;
}

export interface PlanOracleResult {
  readonly passed: boolean;
  readonly findings: readonly GateFinding[];
}

export interface PlanOracleInput {
  readonly baselineGitStatus: BaselineGitStatus;
  readonly currentGitStatus: BaselineGitStatus;
  readonly branchA: SpecialistOutput;
  readonly branchB: SpecialistOutput;
  readonly guardrailPatterns: readonly GuardrailPattern[];
  readonly domainCoreDirs: readonly string[];
  readonly forbiddenCoreImports: readonly string[];
}
