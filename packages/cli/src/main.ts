import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AgentRouter,
  CliProcessAgentAdapter,
  HttpAgentAdapter,
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
  antigravityCliSpec,
  claudeCodeCliSpec,
  copilotCliSpec,
  ollamaEndpoint,
  parseLayerPoolsConfig,
  resolveAgentRoutingConfig,
  type AgentRoutingConfig,
  type ApprovalGateModes,
  type TraceSinkPort,
} from '@orquestia/core';
import { ApprovalsCommand } from './approvals-command.js';
import { AuthCommand } from './auth-command.js';
import { CodeCommand } from './code-command.js';
import { buildCodeCommandDependencies, REPO_BASE_REF } from './code-command-wiring.js';
import { CommandRouter } from './command-router.js';
import { ConsoleTraceSink, type VerbosityLevel } from './console-trace-sink.js';
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

/**
 * Default Tri-Planar assignment — used whenever `orquestia.config.yaml` is
 * absent/malformed, or its `layers.planning_architecture`/
 * `layers.coding_scaffolding_tests` sections don't resolve to a registered
 * agent (see `loadAgentRoutingConfig` and `resolveAgentRoutingConfig`).
 */
const DEFAULT_AGENT_ROUTING: AgentRoutingConfig = {
  branch2a: 'claude_code',
  branch2b: 'copilot_cli',
};

const QUEUE_DAEMON_SCRIPT_PATH = fileURLToPath(new URL('./queue-daemon.js', import.meta.url));

const MAX_VERBOSITY_LEVEL = 3;

/**
 * Extracts a global `-v`/`-vv`/`-vvv` (repeatable or stacked) or
 * `--verbosity <0-3>` flag from `argv`, returning the remaining args
 * unchanged so command-specific parsing (e.g. `code`'s `--ship`) is
 * unaffected by its position. Multiple occurrences take the highest level.
 */
export function parseVerbosity(argv: readonly string[]): {
  readonly level: VerbosityLevel;
  readonly rest: readonly string[];
} {
  let level = 0;
  const rest: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] as string;
    const shorthandMatch = /^-(v+)$/.exec(arg);
    if (shorthandMatch) {
      level = Math.max(level, (shorthandMatch[1] as string).length);
      continue;
    }
    if (arg === '--verbosity') {
      const value = Number(argv[i + 1]);
      if (Number.isInteger(value) && value >= 0 && value <= MAX_VERBOSITY_LEVEL) {
        level = Math.max(level, value);
        i += 1;
        continue;
      }
    }
    rest.push(arg);
  }

  return { level: Math.min(level, MAX_VERBOSITY_LEVEL) as VerbosityLevel, rest };
}

/**
 * Reads `<cwd>/orquestia.config.yaml`'s `layers:` section and resolves it
 * to an `AgentRoutingConfig`, falling back to `DEFAULT_AGENT_ROUTING`
 * whenever the file is absent, its `layers:` section is malformed, or a
 * layer doesn't resolve to a registered agent — mirrors `PlanCommand`'s own
 * `loadConfigOrDefault` fallback-on-failure convention, since this must
 * stay non-fatal for `cwd`s (fixtures, fresh projects) with no config file.
 */
async function loadAgentRoutingConfig(cwd: string): Promise<AgentRoutingConfig> {
  try {
    const config = await new YamlConfigReader(join(cwd, 'orquestia.config.yaml')).loadConfig();
    return resolveAgentRoutingConfig(parseLayerPoolsConfig(config.raw), DEFAULT_AGENT_ROUTING);
  } catch {
    return DEFAULT_AGENT_ROUTING;
  }
}

/** Wires the full `orquestia` command surface against `<cwd>/.orquestia/`. */
export async function buildRouter(cwd: string, traceSink?: TraceSinkPort): Promise<CommandRouter> {
  const stateStore = new JsonFileApprovalStateStore(join(cwd, '.orquestia', 'state.json'));
  const manager = new DurableApprovalManager(
    stateStore,
    new SystemClock(),
    new RandomTokenGenerator(),
    DEFAULT_GATE_MODES,
  );

  const agentRoutingConfig = await loadAgentRoutingConfig(cwd);
  const agentRouter = new AgentRouter(
    [
      new CliProcessAgentAdapter(claudeCodeCliSpec),
      new CliProcessAgentAdapter(copilotCliSpec),
      new CliProcessAgentAdapter(antigravityCliSpec),
      new HttpAgentAdapter(ollamaEndpoint, fetch),
    ],
    agentRoutingConfig,
    new SystemClock(),
    traceSink,
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
  const { level, rest } = parseVerbosity(argv);
  const traceSink =
    level > 0 ? new ConsoleTraceSink(level, (line) => process.stderr.write(line)) : undefined;
  const router = await buildRouter(cwd, traceSink);
  return router.run(rest);
}
