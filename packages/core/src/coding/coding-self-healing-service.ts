import type { CheckpointPort } from '../workspace/types.js';
import type { CodingOracleRunner } from './coding-oracle-runner.js';
import {
  InvalidCodingSelfHealConfigError,
  type CodingRemediationDispatcherPort,
  type CodingSelfHealAttempt,
  type CodingSelfHealConfig,
  type CodingSelfHealOutcome,
  type OracleCommands,
  type OracleStageName,
} from './types.js';

/**
 * Coding DAG Phase 4: a bounded self-healing loop with dual rollback
 * ($f^{op}$). Before each retry, snapshots a checkpoint; if the targeted
 * remediation doesn't converge (the oracle still fails afterward), rolls
 * back to that checkpoint so the next attempt starts clean rather than
 * compounding a non-convergent edit.
 */
export class CodingSelfHealingService {
  constructor(
    private readonly oracleRunner: CodingOracleRunner,
    private readonly checkpoint: CheckpointPort,
    private readonly remediationDispatcher: CodingRemediationDispatcherPort,
    private readonly config: CodingSelfHealConfig,
  ) {
    if (config.maxRetries < 0) {
      throw new InvalidCodingSelfHealConfigError('maxRetries must be zero or greater.');
    }
  }

  async run(commands: OracleCommands): Promise<CodingSelfHealOutcome> {
    const attempts: CodingSelfHealAttempt[] = [];
    let result = await this.oracleRunner.run(commands);
    attempts.push({ attempt: 0, result, rolledBack: false });

    let healAttempt = 1;
    while (!result.passed && healAttempt <= this.config.maxRetries) {
      const checkpointHandle = await this.checkpoint.create();
      await this.remediationDispatcher.remediate(
        result.exitCode as 10 | 20 | 30,
        result.failedStage as OracleStageName,
      );

      const retried = await this.oracleRunner.run(commands);
      const rolledBack = !retried.passed;
      if (rolledBack) {
        await this.checkpoint.rollback(checkpointHandle);
      }

      attempts.push({ attempt: healAttempt, result: retried, rolledBack });
      result = retried;
      healAttempt += 1;
    }

    return {
      status: result.passed ? 'passed' : 'exhausted',
      finalResult: result,
      attempts,
    };
  }
}
