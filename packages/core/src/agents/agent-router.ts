import type { SpecialistBranch } from '../planning/types.js';
import {
  UnknownAgentError,
  type AgentAdapterPort,
  type AgentInvocationRequest,
  type AgentInvocationResult,
  type AgentRoutingConfig,
} from './types.js';

/**
 * Dispatches Branch 2A/2B workloads to whichever agent subscription
 * {@link AgentRoutingConfig} (`agents.branch_2a` / `agents.branch_2b`)
 * currently assigns to that branch, decoupling the DAG phases from which of
 * the registered agent CLIs (Antigravity, Claude Code, Copilot CLI) does
 * the work.
 */
export class AgentRouter {
  private readonly adaptersByName: ReadonlyMap<string, AgentAdapterPort>;

  constructor(
    adapters: readonly AgentAdapterPort[],
    private readonly routing: AgentRoutingConfig,
  ) {
    this.adaptersByName = new Map(adapters.map((adapter) => [adapter.name, adapter]));
  }

  async dispatch(
    branch: SpecialistBranch,
    request: Omit<AgentInvocationRequest, 'branch'>,
  ): Promise<AgentInvocationResult> {
    const agentName = branch === '2A' ? this.routing.branch2a : this.routing.branch2b;
    const adapter = this.adaptersByName.get(agentName);
    if (!adapter) {
      throw new UnknownAgentError(agentName);
    }

    return adapter.invoke({ ...request, branch });
  }
}
