import { join } from 'node:path';
import {
  AgentRouter,
  AgentSpecialistDispatcher,
  CliProcessAgentAdapter,
  DurableApprovalManager,
  FsFileExistencePort,
  GitStatusSnapshotter,
  JsonFileApprovalStateStore,
  RandomTokenGenerator,
  SystemClock,
  YamlConfigReader,
  claudeCodeCliSpec,
  copilotCliSpec,
  type AgentRoutingConfig,
  type ApprovalGateModes,
} from '@orquestia/core';
import { ApprovalsCommand } from './approvals-command.js';
import { CommandRouter } from './command-router.js';
import { PendingCommand } from './pending-command.js';
import { PlanCommand } from './plan-command.js';
import type { CommandResult } from './types.js';

const DEFAULT_GATE_MODES: ApprovalGateModes = {
  after_planning: 'auto',
  before_coding: 'prompt',
  before_rebase: 'auto',
  before_ship: 'manual_token',
};

/** Default Tri-Planar assignment until `agents.branch_2a`/`branch_2b` config parsing exists. */
const DEFAULT_AGENT_ROUTING: AgentRoutingConfig = {
  branch2a: 'claude_code',
  branch2b: 'copilot_cli',
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

  const agentRouter = new AgentRouter(
    [new CliProcessAgentAdapter(claudeCodeCliSpec), new CliProcessAgentAdapter(copilotCliSpec)],
    DEFAULT_AGENT_ROUTING,
  );
  const planCommand = new PlanCommand(
    new GitStatusSnapshotter(cwd),
    new YamlConfigReader(join(cwd, 'orquestia.config.yaml')),
    new FsFileExistencePort(),
    (taskId) => new AgentSpecialistDispatcher(agentRouter, cwd, taskId),
  );

  return new CommandRouter([
    new ApprovalsCommand(manager),
    planCommand,
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
