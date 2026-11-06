import { describe, expect, it } from 'vitest';
import { DefaultStrategyRouter } from './strategy-router.js';
import { FakeRateLimitCheckPort } from './test-builders.js';
import { NoProvidersAvailableError, UnknownStrategyError } from './types.js';
import type { LayerConfig, ProviderEntry } from './types.js';

function provider(overrides: Partial<ProviderEntry> & { name: string }): ProviderEntry {
  return { provider: 'openai-compatible', baseUrl: 'http://localhost', model: 'm', ...overrides };
}

function layer(
  overrides: Partial<LayerConfig> & { strategy: LayerConfig['strategy'] },
): LayerConfig {
  return {
    name: 'planning_architecture',
    enabled: true,
    primaryFallback: false,
    providers: [],
    ...overrides,
  };
}

describe('DefaultStrategyRouter', () => {
  it('throws NoProvidersAvailableError when the layer has an empty pool', () => {
    const router = new DefaultStrategyRouter(new FakeRateLimitCheckPort());

    expect(() => router.selectProvider(layer({ strategy: 'round_robin', providers: [] }))).toThrow(
      NoProvidersAvailableError,
    );
  });

  describe('quota_aware', () => {
    it('picks the first provider that is not rate-limited', () => {
      const a = provider({ name: 'a' });
      const b = provider({ name: 'b' });
      const router = new DefaultStrategyRouter(new FakeRateLimitCheckPort(new Set(['a'])));

      const selection = router.selectProvider(
        layer({ strategy: 'quota_aware', providers: [a, b] }),
      );

      expect(selection).toEqual({ layer: 'planning_architecture', provider: b });
    });

    it('throws NoProvidersAvailableError when every provider is rate-limited', () => {
      const a = provider({ name: 'a' });
      const router = new DefaultStrategyRouter(new FakeRateLimitCheckPort(new Set(['a'])));

      expect(() =>
        router.selectProvider(layer({ strategy: 'quota_aware', providers: [a] })),
      ).toThrow(NoProvidersAvailableError);
    });
  });

  describe('least_cost', () => {
    it('picks the provider with the lowest costTier', () => {
      const cheap = provider({ name: 'cheap', costTier: 1 });
      const pricey = provider({ name: 'pricey', costTier: 5 });
      const router = new DefaultStrategyRouter(new FakeRateLimitCheckPort());

      const selection = router.selectProvider(
        layer({ strategy: 'least_cost', providers: [pricey, cheap] }),
      );

      expect(selection.provider).toBe(cheap);
    });

    it('treats a missing costTier as infinitely expensive', () => {
      const untiered = provider({ name: 'untiered' });
      const tiered = provider({ name: 'tiered', costTier: 10 });
      const router = new DefaultStrategyRouter(new FakeRateLimitCheckPort());

      const selection = router.selectProvider(
        layer({ strategy: 'least_cost', providers: [untiered, tiered] }),
      );

      expect(selection.provider).toBe(tiered);
    });
  });

  describe('latency_priority', () => {
    it('picks the provider with the lowest latencyTier', () => {
      const fast = provider({ name: 'fast', latencyTier: 1 });
      const slow = provider({ name: 'slow', latencyTier: 9 });
      const router = new DefaultStrategyRouter(new FakeRateLimitCheckPort());

      const selection = router.selectProvider(
        layer({ strategy: 'latency_priority', providers: [slow, fast] }),
      );

      expect(selection.provider).toBe(fast);
    });
  });

  describe('round_robin', () => {
    it('rotates through the pool in order, wrapping around', () => {
      const a = provider({ name: 'a' });
      const b = provider({ name: 'b' });
      const config = layer({ strategy: 'round_robin', providers: [a, b] });
      const router = new DefaultStrategyRouter(new FakeRateLimitCheckPort());

      const picks = [
        router.selectProvider(config).provider,
        router.selectProvider(config).provider,
        router.selectProvider(config).provider,
      ];

      expect(picks).toEqual([a, b, a]);
    });

    it('keeps separate cursors per layer', () => {
      const a = provider({ name: 'a' });
      const b = provider({ name: 'b' });
      const layerOne = layer({ name: 'layer-one', strategy: 'round_robin', providers: [a, b] });
      const layerTwo = layer({ name: 'layer-two', strategy: 'round_robin', providers: [a, b] });
      const router = new DefaultStrategyRouter(new FakeRateLimitCheckPort());

      router.selectProvider(layerOne);
      const layerOneSecondPick = router.selectProvider(layerOne).provider;
      const layerTwoFirstPick = router.selectProvider(layerTwo).provider;

      expect(layerOneSecondPick).toBe(b);
      expect(layerTwoFirstPick).toBe(a);
    });
  });

  it('throws UnknownStrategyError for an unrecognized strategy value', () => {
    const a = provider({ name: 'a' });
    const router = new DefaultStrategyRouter(new FakeRateLimitCheckPort());
    const invalidLayer = {
      ...layer({ strategy: 'round_robin', providers: [a] }),
      strategy: 'unknown_strategy',
    } as unknown as LayerConfig;

    expect(() => router.selectProvider(invalidLayer)).toThrow(UnknownStrategyError);
  });
});
