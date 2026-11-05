import { join } from 'node:path';
import {
  DurableApprovalManager,
  JsonFileApprovalStateStore,
  RandomTokenGenerator,
  SystemClock,
  type ApprovalGateModes,
} from '@orquestia/core';
import { ApprovalsCommand } from './approvals-command.js';
import { CommandRouter } from './command-router.js';
import { PendingCommand } from './pending-command.js';
import type { CommandResult } from './types.js';

const DEFAULT_GATE_MODES: ApprovalGateModes = {
  after_planning: 'auto',
  before_coding: 'prompt',
  before_rebase: 'auto',
  before_ship: 'manual_token',
};

/** Wires the full `orquestia` command surface against `<cwd>/.orquestia/`. */
export function buildRouter(cwd: string): CommandRouter {
  const stateStore = new JsonFileApprovalStateStore(join(cwd, '.orquestia', 'state.json'));
  const manager = new DurableApprovalManager(
    stateStore,
    new SystemClock(),
    new RandomTokenGenerator(),
    DEFAULT_GATE_MODES,
  );

  return new CommandRouter([
    new ApprovalsCommand(manager),
    new PendingCommand(
      'plan',
      'Run the Planning DAG (architecture spec synthesis)',
      'full multi-service wiring across the Planning DAG and Atlassian ALM adapters — needs a dedicated follow-up ticket',
    ),
    new PendingCommand(
      'code',
      'Run the Coding DAG (domain implementation + verification)',
      'full multi-service wiring across the Coding DAG and agent adapters — needs a dedicated follow-up ticket',
    ),
    new PendingCommand(
      'auth',
      'Authenticate with Atlassian (OAuth 2.0 + PKCE)',
      'a concrete encrypted vault storage driver (SQLCipher/HashiCorp) not yet added as a dependency',
    ),
    new PendingCommand(
      'queue',
      'Inspect the worktree task queue',
      'the background daemon & IPC layer (not yet built)',
    ),
  ]);
}

export async function runCli(argv: readonly string[], cwd: string): Promise<CommandResult> {
  const router = buildRouter(cwd);
  return router.run(argv);
}
