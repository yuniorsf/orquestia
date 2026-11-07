import type { LayerConfig } from '../load-balancer/types.js';
import type { AgentName, AgentRoutingConfig } from './types.js';

/** Names of the two `orquestia.config.yaml` layers that seed Branch 2A/2B dispatch. */
export const PLANNING_LAYER_NAME = 'planning_architecture';
export const CODING_LAYER_NAME = 'coding_scaffolding_tests';

/**
 * Config-level provider ids (free strings in `orquestia.config.yaml`) don't
 * always match the domain `AgentName` literal 1:1 (e.g. `'github_copilot'`
 * vs. `'copilot_cli'`) — this is the single place that translation is
 * allowed to happen, so no call site re-derives or hardcodes it. A
 * provider id with no entry here is skipped, not rejected: a layer may
 * legitimately mix adapter-backed providers with ones nothing can dispatch
 * to yet (a future `openai_compatible` provider type, say).
 */
const PROVIDER_ID_TO_AGENT_NAME: ReadonlyMap<string, AgentName> = new Map([
  ['claude_code', 'claude_code'],
  ['antigravity', 'antigravity'],
  ['github_copilot', 'copilot_cli'],
  ['ollama', 'ollama'],
]);

/** Picks the lowest-`priority` provider in `layer` that resolves to a known, adapter-backed `AgentName`; `fallback` otherwise. */
function resolveBranch(layer: LayerConfig | undefined, fallback: AgentName): AgentName {
  if (layer === undefined || !layer.enabled) {
    return fallback;
  }

  const sorted = [...layer.providers].sort(
    (a, b) => (a.priority ?? Number.MAX_SAFE_INTEGER) - (b.priority ?? Number.MAX_SAFE_INTEGER),
  );
  for (const entry of sorted) {
    const agentName = PROVIDER_ID_TO_AGENT_NAME.get(entry.provider);
    if (agentName !== undefined) {
      return agentName;
    }
  }
  return fallback;
}

/**
 * Resolves `AgentRoutingConfig` from `orquestia.config.yaml`'s already-parsed
 * `layers:` section — a startup-time seed of which agent owns Branch 2A/2B,
 * not a replacement for `LayerLoadBalancer`/`StrategyRouter`'s per-call
 * quota/cost/latency/429-fallback selection (that remains that layer's job,
 * so the two don't duplicate policy). `fallback` is used whenever the
 * corresponding layer is absent, disabled, or has no provider resolving to
 * a registered agent.
 */
export function resolveAgentRoutingConfig(
  layers: readonly LayerConfig[],
  fallback: AgentRoutingConfig,
): AgentRoutingConfig {
  const byName = new Map(layers.map((layer) => [layer.name, layer]));
  return {
    branch2a: resolveBranch(byName.get(PLANNING_LAYER_NAME), fallback.branch2a),
    branch2b: resolveBranch(byName.get(CODING_LAYER_NAME), fallback.branch2b),
  };
}
