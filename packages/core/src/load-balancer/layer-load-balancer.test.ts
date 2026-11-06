import { describe, expect, it } from 'vitest';
import { LayerLoadBalancer } from './layer-load-balancer.js';
import { DisabledLayerError, UnknownLayerError } from './types.js';
import type { LayerConfig, ProviderSelection, StrategyRouter } from './types.js';

class FakeStrategyRouter implements StrategyRouter {
  readonly calls: LayerConfig[] = [];

  constructor(private readonly result: ProviderSelection) {}

  selectProvider(layer: LayerConfig): ProviderSelection {
    this.calls.push(layer);
    return this.result;
  }
}

const PROVIDER = {
  name: 'p',
  provider: 'openai-compatible',
  baseUrl: 'http://localhost',
  model: 'm',
};

describe('LayerLoadBalancer', () => {
  it('routes to the strategy router for an enabled, known layer', () => {
    const layerConfig: LayerConfig = {
      name: 'planning_architecture',
      enabled: true,
      strategy: 'round_robin',
      primaryFallback: false,
      providers: [PROVIDER],
    };
    const router = new FakeStrategyRouter({ layer: 'planning_architecture', provider: PROVIDER });
    const balancer = new LayerLoadBalancer([layerConfig], router);

    const selection = balancer.route('planning_architecture');

    expect(selection).toEqual({ layer: 'planning_architecture', provider: PROVIDER });
    expect(router.calls).toEqual([layerConfig]);
  });

  it('throws UnknownLayerError for a layer that is not configured', () => {
    const balancer = new LayerLoadBalancer(
      [],
      new FakeStrategyRouter({ layer: 'x', provider: PROVIDER }),
    );

    expect(() => balancer.route('missing')).toThrow(UnknownLayerError);
  });

  it('throws DisabledLayerError for a known but disabled layer', () => {
    const layerConfig: LayerConfig = {
      name: 'self_healing_retries',
      enabled: false,
      strategy: 'round_robin',
      primaryFallback: false,
      providers: [PROVIDER],
    };
    const balancer = new LayerLoadBalancer(
      [layerConfig],
      new FakeStrategyRouter({ layer: 'self_healing_retries', provider: PROVIDER }),
    );

    expect(() => balancer.route('self_healing_retries')).toThrow(DisabledLayerError);
  });
});
