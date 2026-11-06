import type { ProviderEntry } from '../load-balancer/types.js';
import { isRateLimitHttpStatus } from '../rate-limit/rate-limit-signal.js';
import { GatewayHttpError, MalformedGatewayResponseError } from './types.js';
import type {
  ChatCompletionRequest,
  CompletionOutcome,
  OpenAiCompatibleGatewayPort,
} from './types.js';

interface OpenAiChatCompletionResponse {
  readonly choices: ReadonlyArray<{
    readonly message: { readonly content: string };
    readonly finish_reason: string;
  }>;
}

function parseRetryAfterSeconds(headerValue: string | null): number | undefined {
  if (headerValue === null) {
    return undefined;
  }
  const seconds = Number(headerValue);
  if (Number.isNaN(seconds)) {
    return undefined;
  }
  return seconds;
}

/**
 * Real `OpenAiCompatibleGatewayPort` adapter over any OpenAI-wire-compatible
 * `/chat/completions` endpoint — DeepSeek, Qwen, GLM, Kimi, Mistral,
 * Ollama/vLLM, Groq, Cerebras, or the real OpenAI API all work through
 * this one class, parameterized by the `target` {@link ProviderEntry}'s
 * `baseUrl`/`model`. On HTTP 429 it reports `{ kind: 'rate_limited' }`
 * with a cooldown from the `Retry-After` header when present, falling
 * back to `defaultCooldownSeconds` (the `cooldown_on_429_seconds`
 * behavior from the ticket) otherwise — the caller is expected to feed
 * that cooldown into a `RateLimitTracker`.
 */
export class HttpOpenAiCompatibleGateway implements OpenAiCompatibleGatewayPort {
  constructor(private readonly defaultCooldownSeconds: number = 60) {}

  async complete(
    target: ProviderEntry,
    request: ChatCompletionRequest,
    apiKey?: string,
  ): Promise<CompletionOutcome> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey !== undefined) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const response = await fetch(`${target.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: target.model,
        messages: request.messages,
        ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
        ...(request.maxTokens !== undefined ? { max_tokens: request.maxTokens } : {}),
      }),
    });

    if (isRateLimitHttpStatus(response.status)) {
      const cooldownSeconds =
        parseRetryAfterSeconds(response.headers.get('retry-after')) ?? this.defaultCooldownSeconds;
      return { kind: 'rate_limited', cooldownSeconds };
    }

    if (!response.ok) {
      throw new GatewayHttpError(response.status, await response.text());
    }

    const body = (await response.json()) as OpenAiChatCompletionResponse;
    const choice = body.choices[0];
    if (!choice) {
      throw new MalformedGatewayResponseError('response contained no choices.');
    }

    return {
      kind: 'completed',
      result: { content: choice.message.content, finishReason: choice.finish_reason },
    };
  }
}
