import type { SpecialistBranch } from '../planning/types.js';

export type AgentName = 'antigravity' | 'claude_code' | 'copilot_cli' | 'ollama';

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
  /**
   * Post-processes the raw subprocess stdout into the agent's actual answer
   * text, before `extractJsonObject`/`JSON.parse` ever sees it. Identity
   * when absent (the common case: `claude`/`copilot`'s raw stdout already
   * *is* the answer). Exists because some CLIs' structured output modes
   * wrap the answer in an envelope — e.g. `agy --output-format json`
   * returns `{"status":...,"response":"<answer>",...}`, not the answer
   * itself.
   */
  extractResponse?(rawStdout: string): string;
}

/**
 * Parallel to {@link AgentCliSpec}, but for an agent dispatched over HTTP
 * (an OpenAI-compatible chat/completions endpoint — Ollama's local `/v1`
 * API today) rather than a CLI subprocess.
 */
export interface OpenAiCompatibleEndpoint {
  readonly name: AgentName;
  readonly baseUrl: string;
  readonly model: string;
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
