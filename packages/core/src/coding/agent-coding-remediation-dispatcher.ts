import type { AgentRouter } from '../agents/agent-router.js';
import type { SpecialistBranch } from '../planning/types.js';
import type { WorktreeHandle } from '../workspace/types.js';
import {
  parseSynthesisOutput,
  writeSynthesizedFiles,
  type FileWriterPort,
} from './synthesis-json-protocol.js';
import type {
  CodingRemediationDispatcherPort,
  CommandRunnerPort,
  OracleCommands,
  OracleStageName,
} from './types.js';

// Per the self-healing table, Exit 20 (compiler/lint) and Exit 30
// (SOLID/test failure) both route to claude-code (2A); Exit 10
// (formatting/scope drift) is handled deterministically in `remediate`
// below and never reaches an agent at all, so this is the only branch
// that call site can ever pass here.
const REMEDIATION_BRANCH: SpecialistBranch = '2A';

function buildRemediationPrompt(failedStage: OracleStageName, diagnostics: string): string {
  return [
    `The Coding DAG Oracle failed at stage "${failedStage}". Diagnose and fix the issue based on this diagnostic output:`,
    '---',
    diagnostics.trim().length > 0 ? diagnostics.trim() : '(no output captured)',
    '---',
    'Do not use any tools — just generate the corrected file content as text.',
    'Respond with ONLY a single JSON object, no markdown fences and no commentary, of this exact shape,',
    'listing every file you changed:',
    '{"files":[{"path":"<repo-relative path>","content":"<full corrected file contents>"}]}',
  ].join('\n');
}

/**
 * Real `CodingRemediationDispatcherPort` adapter for Coding DAG Phase 4
 * self-healing. Exit 10 (formatting/scope drift) is remediated
 * deterministically by re-running `formatFixCommand` — no agent call
 * needed, since formatting has one correct deterministic answer. Exit
 * 20/30 re-run the failed stage's command to capture fresh diagnostics,
 * then dispatch to Branch 2A (claude-code) with those diagnostics in the
 * prompt, writing back whatever files the agent reports changing (same
 * JSON protocol and no-tool-access convention as the initial synthesis
 * dispatch).
 */
export class AgentCodingRemediationDispatcher implements CodingRemediationDispatcherPort {
  constructor(
    private readonly commandRunner: CommandRunnerPort,
    private readonly agentRouter: AgentRouter,
    private readonly fileWriter: FileWriterPort,
    private readonly worktree: WorktreeHandle,
    private readonly oracleCommands: OracleCommands,
    private readonly formatFixCommand: string,
  ) {}

  async remediate(exitCode: 10 | 20 | 30, failedStage: OracleStageName): Promise<void> {
    if (exitCode === 10) {
      await this.commandRunner.run(this.formatFixCommand);
      return;
    }

    const diagnosticRun = await this.commandRunner.run(this.oracleCommands[failedStage]);
    const result = await this.agentRouter.dispatch(REMEDIATION_BRANCH, {
      cwd: this.worktree.path,
      prompt: buildRemediationPrompt(failedStage, diagnosticRun.stdout || diagnosticRun.stderr),
    });

    const files = parseSynthesisOutput(REMEDIATION_BRANCH, result.stdout);
    await writeSynthesizedFiles(this.fileWriter, this.worktree.path, files);
  }
}
