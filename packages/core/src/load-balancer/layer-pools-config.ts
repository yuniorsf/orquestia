import { InvalidLayerPoolsConfigError } from './types.js';
import type { LayerConfig, ProviderEntry, ProviderStrategyName } from './types.js';

const KNOWN_STRATEGIES: ReadonlySet<string> = new Set([
  'quota_aware',
  'least_cost',
  'latency_priority',
  'round_robin',
]);

/**
 * Parses the `layers:` section of `orquestia.config.yaml` (one entry per
 * DAG phase — `planning_architecture`, `coding_scaffolding_tests`,
 * `code_review_qa`, `self_healing_retries`) into {@link LayerConfig}s
 * ready for {@link LayerLoadBalancer}. Pure — no I/O; the raw YAML
 * document is already loaded by `ConfigReaderPort`.
 */
export function parseLayerPoolsConfig(
  raw: Readonly<Record<string, unknown>>,
): readonly LayerConfig[] {
  const layersRaw = requireMapping(raw.layers, 'layers');
  return Object.entries(layersRaw).map(([name, value]) => parseLayer(name, value));
}

function parseLayer(name: string, value: unknown): LayerConfig {
  const layer = requireMapping(value, `layers.${name}`);

  const enabled = layer.enabled;
  if (typeof enabled !== 'boolean') {
    throw new InvalidLayerPoolsConfigError(`"layers.${name}.enabled" must be a boolean.`);
  }

  const strategyRaw = layer.strategy;
  if (typeof strategyRaw !== 'string' || !KNOWN_STRATEGIES.has(strategyRaw)) {
    throw new InvalidLayerPoolsConfigError(
      `"layers.${name}.strategy" must be one of quota_aware, least_cost, latency_priority, round_robin.`,
    );
  }

  const primaryFallback = layer.primary_fallback;
  if (typeof primaryFallback !== 'boolean') {
    throw new InvalidLayerPoolsConfigError(`"layers.${name}.primary_fallback" must be a boolean.`);
  }

  const providersRaw = layer.providers;
  if (!Array.isArray(providersRaw)) {
    throw new InvalidLayerPoolsConfigError(`"layers.${name}.providers" must be a list.`);
  }
  const providers = providersRaw.map((entry, index) => parseProvider(name, index, entry));

  return {
    name,
    enabled,
    strategy: strategyRaw as ProviderStrategyName,
    primaryFallback,
    providers,
  };
}

function parseProvider(layerName: string, index: number, value: unknown): ProviderEntry {
  const path = `layers.${layerName}.providers[${index}]`;
  const entry = requireMapping(value, path);

  const provider: ProviderEntry = {
    name: requireString(entry.name, `${path}.name`),
    provider: requireString(entry.provider, `${path}.provider`),
    baseUrl: requireString(entry.base_url, `${path}.base_url`),
    model: requireString(entry.model, `${path}.model`),
  };

  const weight = optionalNumber(entry.weight, `${path}.weight`);
  const priority = optionalNumber(entry.priority, `${path}.priority`);
  const costTier = optionalNumber(entry.cost_tier, `${path}.cost_tier`);
  const latencyTier = optionalNumber(entry.latency_tier, `${path}.latency_tier`);

  return {
    ...provider,
    ...(weight !== undefined ? { weight } : {}),
    ...(priority !== undefined ? { priority } : {}),
    ...(costTier !== undefined ? { costTier } : {}),
    ...(latencyTier !== undefined ? { latencyTier } : {}),
  };
}

function requireMapping(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new InvalidLayerPoolsConfigError(`"${path}" must be a mapping.`);
  }
  return value as Record<string, unknown>;
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new InvalidLayerPoolsConfigError(`"${path}" must be a non-empty string.`);
  }
  return value;
}

function optionalNumber(value: unknown, path: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'number') {
    throw new InvalidLayerPoolsConfigError(`"${path}" must be a number.`);
  }
  return value;
}
