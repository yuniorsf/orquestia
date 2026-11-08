import type { AgentRouter } from '@orquestia/core';
import { CodeCommand } from './code-command.js';
import { buildDescribedCodeCommandDependencies } from './code-command-wiring.js';
import type { ImplementCommandDependencies } from './implement-command.js';

/**
 * Builds `ImplementCommand`'s dependencies for `buildRouter` (`main.ts`).
 * Pulled into its own file and excluded from coverage, same convention as
 * `code-command-wiring.ts`/`plan-command-wiring.ts`: `buildCodeCommand` only
 * runs once `ImplementCommand.run()` actually dispatches, which means a
 * real headless `claude`/`copilot` process.
 */
export function buildImplementCommandDependencies(
  cwd: string,
  agentRouter: AgentRouter,
): ImplementCommandDependencies {
  return {
    buildCodeCommand: (taskDescription: string) =>
      new CodeCommand(buildDescribedCodeCommandDependencies(cwd, agentRouter, taskDescription)),
  };
}
