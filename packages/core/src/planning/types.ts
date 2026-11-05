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

export interface RemediationDispatcherPort {
  remediate(branch: SpecialistBranch, findings: readonly GateFinding[]): Promise<SpecialistOutput>;
}

export interface SelfHealConfig {
  readonly maxRetries: number;
}

export interface SelfHealAttempt {
  readonly attempt: number;
  readonly result: PlanOracleResult;
}

export type SelfHealOutcomeStatus = 'passed' | 'aborted' | 'exhausted';

export interface SelfHealOutcome {
  readonly status: SelfHealOutcomeStatus;
  readonly finalResult: PlanOracleResult;
  readonly attempts: readonly SelfHealAttempt[];
}

export class InvalidSelfHealConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidSelfHealConfigError';
  }
}

export interface PlanSpecWriterPort {
  writeSpec(taskId: string, markdown: string): Promise<string>;
}

export interface ConfluencePublisherPort {
  publishPage(title: string, markdown: string): Promise<void>;
}

export interface JiraStatusSyncPort {
  transitionIssue(issueKey: string, statusName: string): Promise<void>;
}

export interface PlanSynthesisInput {
  readonly taskId: string;
  readonly issueKey: string | null;
  readonly oracleResult: PlanOracleResult;
  readonly branchA: SpecialistOutput;
  readonly branchB: SpecialistOutput;
}

export class UnverifiedPlanError extends Error {
  constructor(taskId: string) {
    super(`Cannot synthesize plan "${taskId}": the Deterministic Plan Oracle has not passed.`);
    this.name = 'UnverifiedPlanError';
  }
}
