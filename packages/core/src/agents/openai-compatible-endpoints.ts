import type { OpenAiCompatibleEndpoint } from './types.js';

/**
 * NOT YET config-driven, same as the three `AgentCliSpec` constants in
 * `agent-cli-specs.ts`: `orquestia.config.yaml`'s `layers.*` sections only
 * select which agent owns a branch (see `resolveAgentRoutingConfig`), not
 * how that agent is reached — base_url/model stay a fixed constant here
 * until that's wired in. Matches `orquestia.config.yaml`'s own
 * `coding_scaffolding_tests`/`code_review_qa` Ollama entries at time of
 * writing: `http://localhost:11434/v1`, `qwen2.5-coder:7b`.
 */
export const ollamaEndpoint: OpenAiCompatibleEndpoint = {
  name: 'ollama',
  baseUrl: 'http://localhost:11434/v1',
  model: 'qwen2.5-coder:7b',
};
