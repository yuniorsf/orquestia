import {
  AgentSpecialistDispatcher,
  type AgentRouter,
  type SpecialistDispatcherPort,
} from '@orquestia/core';
import type { SpecialistDispatcherFactory } from './plan-command.js';

/**
 * Builds `PlanCommand`'s `planDispatcherFactory` for `buildRouter`
 * (`main.ts`). Pulled into its own file — excluded from coverage like
 * `code-command-wiring.ts` — because it only runs once `PlanCommand.run()`
 * actually dispatches, which means a real headless `claude`/`copilot`
 * process; that path is deliberately never exercised by the automated
 * test suite. `PlanCommand`'s own logic is fully covered against fakes
 * in plan-command.test.ts.
 */
export function buildPlanDispatcherFactory(
  cwd: string,
  agentRouter: AgentRouter,
): SpecialistDispatcherFactory {
  return (taskId: string): SpecialistDispatcherPort =>
    new AgentSpecialistDispatcher(agentRouter, cwd, taskId);
}
