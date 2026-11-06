import type { LayerConfig, ProviderSelection, StrategyRouter } from './types.js';
import { DisabledLayerError, UnknownLayerError } from './types.js';

/**
 * Sits between DAG phase execution and model providers: looks up the
 * named layer (`planning_architecture`, `coding_scaffolding_tests`, ...),
 * enforces its `enabled` flag, and delegates provider selection to the
 * injected {@link StrategyRouter}.
 */
export class LayerLoadBalancer {
  private readonly layersByName: ReadonlyMap<string, LayerConfig>;

  constructor(
    layers: readonly LayerConfig[],
    private readonly router: StrategyRouter,
  ) {
    this.layersByName = new Map(layers.map((layer) => [layer.name, layer]));
  }

  route(layerName: string): ProviderSelection {
    const layer = this.layersByName.get(layerName);
    if (!layer) {
      throw new UnknownLayerError(layerName);
    }
    if (!layer.enabled) {
      throw new DisabledLayerError(layerName);
    }
    return this.router.selectProvider(layer);
  }
}
