import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AgentRouter,
  CliProcessAgentAdapter,
  CryptoRandomBytesPort,
  DurableApprovalManager,
  FsFileExistencePort,
  GitStatusSnapshotter,
  JsonFileApprovalStateStore,
  MacosKeychainKeyDerivationPort,
  RandomTokenGenerator,
  SQLCipherVaultProvider,
  SystemClock,
  UnixSocketClient,
  YamlConfigReader,
  claudeCodeCliSpec,
  copilotCliSpec,
  type AgentRoutingConfig,
  type ApprovalGateModes,
} from '@orquestia/core';
import { ApprovalsCommand } from './approvals-command.js';
import { AuthCommand } from './auth-command.js';
import { CodeCommand } from './code-command.js';
import { buildCodeCommandDependencies, REPO_BASE_REF } from './code-command-wiring.js';
import { CommandRouter } from './command-router.js';
import { ChildProcessDaemonLauncher } from './daemon-process-launcher.js';
import { PlanCommand } from './plan-command.js';
import { buildPlanDispatcherFactory } from './plan-command-wiring.js';
import { QueueCommand } from './queue-command.js';
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

const QUEUE_DAEMON_SCRIPT_PATH = fileURLToPath(new URL('./queue-daemon.js', import.meta.url));

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
    buildPlanDispatcherFactory(cwd, agentRouter),
  );
  const codeCommand = new CodeCommand(buildCodeCommandDependencies(cwd, agentRouter));

  // SQLCipher (local, embedded, zero external infra via Node's built-in
  // node:sqlite) is the default vault backend; HashiCorpVaultProvider is
  // a drop-in alternative behind the same CredentialStorePort (ORQ-18/19)
  // for teams that want a shared enterprise vault instead.
  const vaultProvider = new SQLCipherVaultProvider(
    join(cwd, '.orquestia', 'vault.db'),
    new MacosKeychainKeyDerivationPort(new CryptoRandomBytesPort()),
    new CryptoRandomBytesPort(),
    new SystemClock(),
    new RandomTokenGenerator(),
  );
  const authCommand = new AuthCommand(vaultProvider);

  const orquestiaDir = join(cwd, '.orquestia');
  const socketPath = join(orquestiaDir, 'daemon.sock');
  const queueCommand = new QueueCommand(
    new UnixSocketClient(socketPath),
    new ChildProcessDaemonLauncher(
      QUEUE_DAEMON_SCRIPT_PATH,
      [cwd],
      cwd,
      join(orquestiaDir, 'daemon.log'),
    ),
    REPO_BASE_REF,
  );

  return new CommandRouter([
    new ApprovalsCommand(manager),
    planCommand,
    codeCommand,
    authCommand,
    queueCommand,
  ]);
}

export async function runCli(argv: readonly string[], cwd: string): Promise<CommandResult> {
  const router = buildRouter(cwd);
  return router.run(argv);
}
