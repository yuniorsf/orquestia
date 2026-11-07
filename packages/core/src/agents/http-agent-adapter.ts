import type {
  AgentAdapterPort,
  AgentInvocationRequest,
  AgentInvocationResult,
  AgentName,
  OpenAiCompatibleEndpoint,
} from './types.js';

interface ChatCompletionResponse {
  readonly choices?: ReadonlyArray<{ readonly message?: { readonly content?: unknown } }>;
}

function extractMessageContent(bodyText: string): string | null {
  let parsed: ChatCompletionResponse;
  try {
    parsed = JSON.parse(bodyText) as ChatCompletionResponse;
  } catch {
    return null;
  }
  const content = parsed.choices?.[0]?.message?.content;
  return typeof content === 'string' ? content : null;
}

/**
 * Headless invocation of an OpenAI-compatible chat/completions HTTP
 * endpoint (Ollama's local `/v1` API today; any other OpenAI-compatible
 * provider — DeepSeek, Mistral, etc. — fits the same shape later).
 * Mirrors {@link CliProcessAgentAdapter}'s `AgentAdapterPort` contract
 * exactly, so `AgentRouter` stays adapter-kind-agnostic: a non-2xx
 * response, a network failure, or an unparseable body all map to a
 * non-zero `exitCode` with the detail in `stderr`, never a thrown
 * exception. Uses the platform's built-in `fetch` (no HTTP client
 * dependency) — `axios` is a banned domain-core import for exactly this
 * kind of code (see `orquestia.config.yaml`'s `forbidden_dependencies`).
 * `fetchFn` is injected (defaulting only at the composition root, not
 * here) so tests never need a real network call.
 */
export class HttpAgentAdapter implements AgentAdapterPort {
  readonly name: AgentName;

  constructor(
    private readonly endpoint: OpenAiCompatibleEndpoint,
    private readonly fetchFn: typeof fetch,
  ) {
    this.name = endpoint.name;
  }

  async invoke(request: AgentInvocationRequest): Promise<AgentInvocationResult> {
    let response: Response;
    try {
      response = await this.fetchFn(`${this.endpoint.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: this.endpoint.model,
          messages: [{ role: 'user', content: request.prompt }],
          stream: false,
        }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { agent: this.name, exitCode: 1, stdout: '', stderr: message };
    }

    const bodyText = await response.text();
    if (!response.ok) {
      return { agent: this.name, exitCode: response.status, stdout: '', stderr: bodyText };
    }

    const content = extractMessageContent(bodyText);
    if (content === null) {
      return {
        agent: this.name,
        exitCode: 1,
        stdout: '',
        stderr: `Response did not contain choices[0].message.content: ${bodyText}`,
      };
    }
    return { agent: this.name, exitCode: 0, stdout: content, stderr: '' };
  }
}
