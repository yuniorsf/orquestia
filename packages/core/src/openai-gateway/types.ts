import type { ProviderEntry } from '../load-balancer/types.js';

export interface ChatMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

export interface ChatCompletionRequest {
  readonly messages: readonly ChatMessage[];
  readonly temperature?: number;
  readonly maxTokens?: number;
}

export interface ChatCompletionResult {
  readonly content: string;
  readonly finishReason: string;
}

export type CompletionOutcome =
  | { readonly kind: 'completed'; readonly result: ChatCompletionResult }
  | { readonly kind: 'rate_limited'; readonly cooldownSeconds: number };

/**
 * One adapter covers every OpenAI-wire-compatible backend (DeepSeek,
 * Qwen, GLM, Kimi, Mistral, Ollama/vLLM, Groq, Cerebras, ...) since they
 * all speak the same `/chat/completions` request/response shape — the
 * `target` {@link ProviderEntry} (`baseUrl` + `model`) is what actually
 * distinguishes one backend from another, not separate adapter classes.
 */
export interface OpenAiCompatibleGatewayPort {
  complete(
    target: ProviderEntry,
    request: ChatCompletionRequest,
    apiKey?: string,
  ): Promise<CompletionOutcome>;
}

export class GatewayHttpError extends Error {
  constructor(status: number, body: string) {
    super(`OpenAI-compatible gateway request failed (HTTP ${status}): ${body}`);
    this.name = 'GatewayHttpError';
  }
}

export class MalformedGatewayResponseError extends Error {
  constructor(reason: string) {
    super(`OpenAI-compatible gateway returned a malformed response: ${reason}`);
    this.name = 'MalformedGatewayResponseError';
  }
}
