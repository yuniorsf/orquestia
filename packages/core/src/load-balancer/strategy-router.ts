import type {
  LayerConfig,
  ProviderEntry,
  ProviderSelection,
  RateLimitCheckPort,
  StrategyRouter,
} from './types.js';
import { NoProvidersAvailableError, UnknownStrategyError } from './types.js';

/**
 * Selects one provider from a layer's pool per its configured strategy:
 * `quota_aware` skips providers the injected {@link RateLimitCheckPort}
 * reports as currently rate-limited, `least_cost`/`latency_priority` pick
 * the lowest `costTier`/`latencyTier`, and `round_robin` rotates through
 * the pool, remembering its cursor per layer across calls.
 */
export class DefaultStrategyRouter implements StrategyRouter {
  private readonly roundRobinCursors = new Map<string, number>();

  constructor(private readonly rateLimitCheck: RateLimitCheckPort) {}

  selectProvider(layer: LayerConfig): ProviderSelection {
    if (layer.providers.length === 0) {
      throw new NoProvidersAvailableError(layer.name);
    }

    switch (layer.strategy) {
      case 'quota_aware':
        return { layer: layer.name, provider: this.selectQuotaAware(layer) };
      case 'least_cost':
        return {
          layer: layer.name,
          provider: this.selectByTier(layer, (provider) => provider.costTier),
        };
      case 'latency_priority':
        return {
          layer: layer.name,
          provider: this.selectByTier(layer, (provider) => provider.latencyTier),
        };
      case 'round_robin':
        return { layer: layer.name, provider: this.selectRoundRobin(layer) };
      default: {
        const exhaustiveCheck: never = layer.strategy;
        throw new UnknownStrategyError(exhaustiveCheck as string);
      }
    }
  }

  private selectQuotaAware(layer: LayerConfig): ProviderEntry {
    const available = layer.providers.filter(
      (provider) => !this.rateLimitCheck.isRateLimited(provider.name),
    );
    if (available.length === 0) {
      throw new NoProvidersAvailableError(layer.name);
    }
    return available[0] as ProviderEntry;
  }

  private selectByTier(
    layer: LayerConfig,
    tierOf: (provider: ProviderEntry) => number | undefined,
  ): ProviderEntry {
    let best = layer.providers[0] as ProviderEntry;
    let bestTier = tierOf(best) ?? Number.POSITIVE_INFINITY;

    for (const provider of layer.providers) {
      const tier = tierOf(provider) ?? Number.POSITIVE_INFINITY;
      if (tier < bestTier) {
        best = provider;
        bestTier = tier;
      }
    }

    return best;
  }

  private selectRoundRobin(layer: LayerConfig): ProviderEntry {
    const cursor = this.roundRobinCursors.get(layer.name) ?? 0;
    const provider = layer.providers[cursor % layer.providers.length] as ProviderEntry;
    this.roundRobinCursors.set(layer.name, cursor + 1);
    return provider;
  }
}
