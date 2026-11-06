import type { SpecialistBranch } from '../planning/types.js';

export type AgentName = 'antigravity' | 'claude_code' | 'copilot_cli';

export interface AgentInvocationRequest {
  readonly branch: SpecialistBranch;
  readonly cwd: string;
  readonly prompt: string;
}

export interface AgentInvocationResult {
  readonly agent: AgentName;
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface AgentAdapterPort {
  readonly name: AgentName;
  invoke(request: AgentInvocationRequest): Promise<AgentInvocationResult>;
}

export interface AgentCliSpec {
  readonly name: AgentName;
  readonly executable: string;
  buildArgs(request: AgentInvocationRequest): readonly string[];
}

/** `agents.branch_2a` / `agents.branch_2b` from `orquestia.config.yaml`. */
export interface AgentRoutingConfig {
  readonly branch2a: AgentName;
  readonly branch2b: AgentName;
}

export class UnknownAgentError extends Error {
  constructor(name: AgentName) {
    super(`No adapter registered for agent "${name}".`);
    this.name = 'UnknownAgentError';
  }
}

export type DispatchTraceEvent =
  | {
      readonly phase: 'start';
      readonly branch: SpecialistBranch;
      readonly agent: AgentName;
      readonly prompt: string;
    }
  | {
      readonly phase: 'complete';
      readonly branch: SpecialistBranch;
      readonly agent: AgentName;
      readonly exitCode: number;
      readonly stdout: string;
      readonly stderr: string;
      readonly durationMs: number;
    };

/** Injected into {@link AgentRouter} to observe each dispatch; absent by default so existing callers see no behavior change. */
export interface TraceSinkPort {
  onDispatchEvent(event: DispatchTraceEvent): void;
}
