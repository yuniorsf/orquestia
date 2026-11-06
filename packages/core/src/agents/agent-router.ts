import type { SpecialistBranch } from '../planning/types.js';
import type { Clock } from '../shared/clock.js';
import {
  UnknownAgentError,
  type AgentAdapterPort,
  type AgentInvocationRequest,
  type AgentInvocationResult,
  type AgentRoutingConfig,
  type TraceSinkPort,
} from './types.js';

/**
 * Dispatches Branch 2A/2B workloads to whichever agent subscription
 * {@link AgentRoutingConfig} (`agents.branch_2a` / `agents.branch_2b`)
 * currently assigns to that branch, decoupling the DAG phases from which of
 * the registered agent CLIs (Antigravity, Claude Code, Copilot CLI) does
 * the work. When a {@link TraceSinkPort} is supplied, emits a 'start'/
 * 'complete' event around every dispatch (durations from the injected
 * {@link Clock}, never a direct wall-clock read) so a CLI-level verbosity
 * flag can surface what each agent actually did; omitting the sink leaves
 * dispatch behavior byte-for-byte unchanged.
 */
export class AgentRouter {
  private readonly adaptersByName: ReadonlyMap<string, AgentAdapterPort>;

  constructor(
    adapters: readonly AgentAdapterPort[],
    private readonly routing: AgentRoutingConfig,
    private readonly clock: Clock,
    private readonly traceSink?: TraceSinkPort,
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

    this.traceSink?.onDispatchEvent({
      phase: 'start',
      branch,
      agent: agentName,
      prompt: request.prompt,
    });
    const startedAt = this.clock.now();

    const result = await adapter.invoke({ ...request, branch });

    this.traceSink?.onDispatchEvent({
      phase: 'complete',
      branch,
      agent: agentName,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      durationMs: this.clock.now() - startedAt,
    });

    return result;
  }
}
