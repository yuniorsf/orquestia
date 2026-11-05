import type { FileManifestEntry, SpecialistBranch } from '../planning/types.js';
import type { WorktreeHandle } from '../workspace/types.js';

/**
 * Coding DAG Phase 1 input: the disjoint file allocations for `coder_core`
 * (Branch 2A: domain models, algorithms, ports) and `coder_tests` (Branch
 * 2B: DTOs, mocks, and the full unit test suite).
 */
export interface CodingTaskManifest {
  readonly coreLogicSpec: readonly FileManifestEntry[];
  readonly testAndBoilerplateSpec: readonly FileManifestEntry[];
}

export interface DisjointAllocationFinding {
  readonly path: string;
  readonly message: string;
}

export interface DisjointAllocationResult {
  readonly valid: boolean;
  readonly findings: readonly DisjointAllocationFinding[];
}

export class DisjointAllocationError extends Error {
  constructor(findings: readonly DisjointAllocationFinding[]) {
    super(
      `Disjoint file allocation violated (coreLogicSpec ∩ testAndBoilerplateSpec ≠ ∅): ${findings
        .map((finding) => finding.path)
        .join(', ')}`,
    );
    this.name = 'DisjointAllocationError';
  }
}

export interface CodeSynthesisOutput {
  readonly branch: SpecialistBranch;
  readonly filesWritten: readonly string[];
}

export interface CodeSynthesisDispatcherPort {
  synthesize(
    branch: SpecialistBranch,
    worktree: WorktreeHandle,
    manifest: readonly FileManifestEntry[],
  ): Promise<CodeSynthesisOutput>;
}

export interface CodeSynthesisResult {
  readonly worktree: WorktreeHandle;
  readonly branchA: CodeSynthesisOutput;
  readonly branchB: CodeSynthesisOutput;
}

export interface CommandResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface CommandRunnerPort {
  run(command: string): Promise<CommandResult>;
}

/** The 4-stage Coding DAG oracle, sourced from `.harness/harness.env` / `harness.config.json`. */
export interface OracleCommands {
  readonly solidPreflight: string;
  readonly formatCheck: string;
  readonly buildAndLint: string;
  readonly testRun: string;
}

export type OracleStageName = 'solidPreflight' | 'formatCheck' | 'buildAndLint' | 'testRun';

export interface OracleStageRun {
  readonly stage: OracleStageName;
  readonly command: string;
  readonly result: CommandResult;
}

/** Deterministic Coding Oracle exit codes, per ORQUESTIA_SPECIFICATION.md §3.2. */
export type CodingOracleExitCode = 0 | 10 | 20 | 30;

export interface CodingOracleResult {
  readonly passed: boolean;
  readonly exitCode: CodingOracleExitCode;
  readonly failedStage: OracleStageName | null;
  readonly runs: readonly OracleStageRun[];
}

export interface CodingRemediationDispatcherPort {
  remediate(exitCode: 10 | 20 | 30, failedStage: OracleStageName): Promise<void>;
}

export interface CodingSelfHealConfig {
  readonly maxRetries: number;
}

export interface CodingSelfHealAttempt {
  readonly attempt: number;
  readonly result: CodingOracleResult;
  readonly rolledBack: boolean;
}

export type CodingSelfHealStatus = 'passed' | 'exhausted';

export interface CodingSelfHealOutcome {
  readonly status: CodingSelfHealStatus;
  readonly finalResult: CodingOracleResult;
  readonly attempts: readonly CodingSelfHealAttempt[];
}

export class InvalidCodingSelfHealConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCodingSelfHealConfigError';
  }
}

/** Coding DAG Phase 5 (rebase step): outcome of fetching and rebasing a worktree onto `baseRef`. */
export type RebaseOutcome =
  | { readonly status: 'clean' }
  | { readonly status: 'conflict'; readonly conflictingFiles: readonly string[] }
  | { readonly status: 'failed'; readonly reason: string };

export interface RebaseAndVerifyResult {
  readonly rebase: RebaseOutcome;
  /** Only populated when `rebase.status === 'clean'` — the mandatory post-rebase re-run of the Phase 3 oracle. */
  readonly oracle: CodingOracleResult | null;
}

export interface ShipSpec {
  readonly worktree: WorktreeHandle;
  readonly commitMessage: string;
  readonly baseBranch: string;
  readonly prTitle: string;
  readonly prBody: string;
  readonly issueKey: string | null;
  readonly jiraTargetStatus: string;
}

export type ShipStepName = 'stage' | 'commit' | 'push' | 'createPullRequest';

export type ShipOutcome =
  | { readonly status: 'shipped'; readonly pullRequestUrl: string }
  | { readonly status: 'failed'; readonly failedStep: ShipStepName; readonly reason: string };

export class UnverifiedCodeError extends Error {
  constructor(taskId: string) {
    super(`Cannot ship task "${taskId}": the Deterministic Coding Oracle has not passed.`);
    this.name = 'UnverifiedCodeError';
  }
}
