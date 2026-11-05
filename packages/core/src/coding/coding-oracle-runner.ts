import type {
  CodingOracleExitCode,
  CodingOracleResult,
  CommandRunnerPort,
  OracleCommands,
  OracleStageName,
  OracleStageRun,
} from './types.js';

const STAGE_ORDER: readonly OracleStageName[] = [
  'solidPreflight',
  'formatCheck',
  'buildAndLint',
  'testRun',
];

/**
 * Maps each failing stage to its deterministic exit code. `solidPreflight`
 * (Stage 1, the fast SOLID & disjoint-scope check) and `formatCheck` (Stage
 * 2) both route to code 10 — the self-healing table treats "Formatting /
 * Scope Drift" as one bucket, remediated by Branch 2B.
 */
const STAGE_EXIT_CODES: Record<OracleStageName, 10 | 20 | 30> = {
  solidPreflight: 10,
  formatCheck: 10,
  buildAndLint: 20,
  testRun: 30,
};

/**
 * Coding DAG Phase 3: the 4-stage deterministic oracle. Runs each stage's
 * command in order via the injected {@link CommandRunnerPort} and halts at
 * the first non-zero exit, reporting the corresponding exit code.
 */
export class CodingOracleRunner {
  constructor(private readonly commandRunner: CommandRunnerPort) {}

  async run(commands: OracleCommands): Promise<CodingOracleResult> {
    const runs: OracleStageRun[] = [];

    for (const stage of STAGE_ORDER) {
      const command = commands[stage];
      const result = await this.commandRunner.run(command);
      runs.push({ stage, command, result });

      if (result.exitCode !== 0) {
        return {
          passed: false,
          exitCode: STAGE_EXIT_CODES[stage],
          failedStage: stage,
          runs,
        };
      }
    }

    return { passed: true, exitCode: 0 as CodingOracleExitCode, failedStage: null, runs };
  }
}
