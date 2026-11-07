import { join } from 'node:path';
import {
  AgentCodeSynthesisDispatcher,
  AgentCodingRemediationDispatcher,
  AgentSpecialistDispatcher,
  FsFileWriter,
  GitStashCheckpoint,
  GitWorktreeProvisioner,
  ShellCommandRunner,
  ShipService,
  type AgentRouter,
  type CodingTaskManifest,
  type JiraStatusSyncPort,
  type OracleCommands,
} from '@orquestia/core';
import type { CodeCommandDependencies } from './code-command.js';

export const REPO_BASE_REF = 'origin/develop';
const FORMAT_FIX_COMMAND = 'npx prettier --write .';

/** Never actually invoked: `CodeCommand` always ships with `issueKey: null` until ORQ-36 lands real Jira auth. */
const UNSUPPORTED_JIRA_STATUS_SYNC: JiraStatusSyncPort = {
  async transitionIssue(issueKey: string): Promise<void> {
    throw new Error(`Jira status sync is not wired into the CLI yet (issue "${issueKey}").`);
  },
};

export function buildOracleCommands(manifest: CodingTaskManifest): OracleCommands {
  const scopeA = manifest.coreLogicSpec.map((entry) => entry.path).join(',');
  const scopeB = manifest.testAndBoilerplateSpec.map((entry) => entry.path).join(',');
  return {
    solidPreflight: `python3 scripts/verify-solid-contracts.py --target . --base ${REPO_BASE_REF} --scope-a "${scopeA}" --scope-b "${scopeB}"`,
    formatCheck: 'npx prettier --check .',
    buildAndLint: 'npx tsc --noEmit && npx eslint . --max-warnings 0',
    testRun: 'npm test',
  };
}

/**
 * Builds the real `CodeCommandDependencies` for `buildRouter` (`main.ts`).
 * Pulled into its own file — excluded from coverage like the CLI's bin
 * bootstrap files — because every factory here only runs once
 * `CodeCommand.run()` actually reaches that phase, which means dispatching
 * a real headless `claude`/`copilot` CLI process; that path is
 * deliberately never exercised by the automated test suite (see
 * CliProcessAgentAdapter's own tests, which stand in a plain Node
 * subprocess for the real CLI instead). `CodeCommand`'s own logic is
 * fully covered against fakes in code-command.test.ts, and this wiring
 * itself was verified with a real end-to-end run against this repo.
 */
export function buildCodeCommandDependencies(
  cwd: string,
  agentRouter: AgentRouter,
): CodeCommandDependencies {
  const worktreesRoot = join(cwd, '..', 'worktrees');

  return {
    repoBaseRef: REPO_BASE_REF,
    worktreeProvisioner: new GitWorktreeProvisioner(cwd, worktreesRoot),
    checkpointFactory: (worktree) => new GitStashCheckpoint(worktree.path),
    commandRunnerFactory: (worktree) => new ShellCommandRunner(worktree.path),
    planDispatcherFactory: (taskId) => new AgentSpecialistDispatcher(agentRouter, cwd, taskId),
    manifestConflictRemediationDispatcherFactory: (taskId) =>
      new AgentSpecialistDispatcher(agentRouter, cwd, taskId),
    codeSynthesisDispatcherFactory: () =>
      new AgentCodeSynthesisDispatcher(agentRouter, new FsFileWriter()),
    remediationDispatcherFactory: (worktree, commandRunner, oracleCommands) =>
      new AgentCodingRemediationDispatcher(
        commandRunner,
        agentRouter,
        new FsFileWriter(),
        worktree,
        oracleCommands,
        FORMAT_FIX_COMMAND,
      ),
    oracleCommandsFactory: buildOracleCommands,
    shipServiceFactory: (commandRunner) =>
      new ShipService(commandRunner, UNSUPPORTED_JIRA_STATUS_SYNC),
    maxSelfHealRetries: 3,
  };
}
