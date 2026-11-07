import { existsSync } from 'node:fs';
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
import { parseConfigSelector, resolveConfigPath } from './config-profile.js';
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
 * Reads `configPath`'s `layers:` section and resolves it to an
 * `AgentRoutingConfig`, falling back to `DEFAULT_AGENT_ROUTING` whenever
 * the file is absent, its `layers:` section is malformed, or a layer
 * doesn't resolve to a registered agent — mirrors `PlanCommand`'s own
 * `loadConfigOrDefault` fallback-on-failure convention, since this must
 * stay non-fatal for `cwd`s (fixtures, fresh projects) with no config file.
 * An explicitly-named but missing `--config` profile is handled earlier,
 * in `runCli`, with a loud failure — this fallback is for the (common,
 * expected) no-config-at-all case.
 */
async function loadAgentRoutingConfig(configPath: string): Promise<AgentRoutingConfig> {
  try {
    const config = await new YamlConfigReader(configPath).loadConfig();
    return resolveAgentRoutingConfig(parseLayerPoolsConfig(config.raw), DEFAULT_AGENT_ROUTING);
  } catch {
    return DEFAULT_AGENT_ROUTING;
  }
}

/**
 * Wires the full `orquestia` command surface against `<cwd>/.orquestia/`.
 * `configPath` defaults to `<cwd>/orquestia.config.yaml` (today's
 * unchanged behavior) — pass a resolved `.orquestia/configs/<name>.yaml`
 * path (see `resolveConfigPath`) to use a named profile instead.
 */
export async function buildRouter(
  cwd: string,
  traceSink?: TraceSinkPort,
  configPath: string = join(cwd, 'orquestia.config.yaml'),
): Promise<CommandRouter> {
  const stateStore = new JsonFileApprovalStateStore(join(cwd, '.orquestia', 'state.json'));
  const manager = new DurableApprovalManager(
    stateStore,
    new SystemClock(),
    new RandomTokenGenerator(),
    DEFAULT_GATE_MODES,
  );

  const agentRoutingConfig = await loadAgentRoutingConfig(configPath);
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
    new YamlConfigReader(configPath),
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

/** `resolveConfigPath` only ever throws a real `Error`, but this stays defensive and independently testable rather than assuming that forever. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function runCli(argv: readonly string[], cwd: string): Promise<CommandResult> {
  const { level, rest: afterVerbosity } = parseVerbosity(argv);
  const { profile, rest } = parseConfigSelector(afterVerbosity);

  let configPath: string;
  try {
    configPath = resolveConfigPath(cwd, profile);
  } catch (error) {
    return { exitCode: 1, stdout: '', stderr: `${errorMessage(error)}\n` };
  }

  // Unspecified --config silently falls back to defaults elsewhere (no
  // orquestia.config.yaml is a normal, expected state for a fresh
  // project) — but a profile the user explicitly named should fail
  // loudly if it doesn't exist, not silently behave as if it were never
  // passed.
  if (profile !== undefined && !existsSync(configPath)) {
    return {
      exitCode: 1,
      stdout: '',
      stderr: `Config profile "${profile}" not found: ${configPath}\n`,
    };
  }

  const traceSink =
    level > 0 ? new ConsoleTraceSink(level, (line) => process.stderr.write(line)) : undefined;
  const router = await buildRouter(cwd, traceSink, configPath);
  return router.run(rest);
}
