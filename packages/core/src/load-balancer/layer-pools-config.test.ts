import { describe, expect, it } from 'vitest';
import { parseLayerPoolsConfig } from './layer-pools-config.js';
import { InvalidLayerPoolsConfigError } from './types.js';

interface RawLayers {
  readonly layers: {
    planning_architecture: Record<string, unknown>;
    self_healing_retries: Record<string, unknown>;
  };
}

function validRaw(): RawLayers & Record<string, unknown> {
  return {
    layers: {
      planning_architecture: {
        enabled: true,
        strategy: 'quota_aware',
        primary_fallback: true,
        providers: [
          {
            name: 'claude-primary',
            provider: 'anthropic',
            base_url: 'https://api.anthropic.com',
            model: 'claude-opus-4',
            weight: 2,
            priority: 1,
            cost_tier: 3,
            latency_tier: 1,
          },
        ],
      },
      self_healing_retries: {
        enabled: false,
        strategy: 'round_robin',
        primary_fallback: false,
        providers: [],
      },
    },
  };
}

function firstProvider(raw: RawLayers): Record<string, unknown> {
  const providers = raw.layers.planning_architecture.providers as Array<Record<string, unknown>>;
  return providers[0] as Record<string, unknown>;
}

describe('parseLayerPoolsConfig', () => {
  it('parses every layer and provider field, snake_case mapped to camelCase', () => {
    const layers = parseLayerPoolsConfig(validRaw());

    expect(layers).toEqual([
      {
        name: 'planning_architecture',
        enabled: true,
        strategy: 'quota_aware',
        primaryFallback: true,
        providers: [
          {
            name: 'claude-primary',
            provider: 'anthropic',
            baseUrl: 'https://api.anthropic.com',
            model: 'claude-opus-4',
            weight: 2,
            priority: 1,
            costTier: 3,
            latencyTier: 1,
          },
        ],
      },
      {
        name: 'self_healing_retries',
        enabled: false,
        strategy: 'round_robin',
        primaryFallback: false,
        providers: [],
      },
    ]);
  });

  it('omits optional provider fields entirely when absent from the config', () => {
    const raw = validRaw();
    raw.layers.planning_architecture.providers = [
      { name: 'bare', provider: 'anthropic', base_url: 'https://x', model: 'm' },
    ];

    const [layer] = parseLayerPoolsConfig(raw);

    expect(layer?.providers[0]).toEqual({
      name: 'bare',
      provider: 'anthropic',
      baseUrl: 'https://x',
      model: 'm',
    });
  });

  it('throws when "layers" is missing or not a mapping', () => {
    expect(() => parseLayerPoolsConfig({})).toThrow(InvalidLayerPoolsConfigError);
    expect(() => parseLayerPoolsConfig({ layers: ['nope'] })).toThrow(InvalidLayerPoolsConfigError);
  });

  it('throws when a layer entry is not a mapping', () => {
    expect(() => parseLayerPoolsConfig({ layers: { planning_architecture: 'nope' } })).toThrow(
      InvalidLayerPoolsConfigError,
    );
  });

  it('throws when "enabled" is missing or not a boolean', () => {
    const raw = validRaw();
    delete raw.layers.planning_architecture.enabled;

    expect(() => parseLayerPoolsConfig(raw)).toThrow(InvalidLayerPoolsConfigError);
  });

  it('throws when "strategy" is missing or unrecognized', () => {
    const raw = validRaw();
    raw.layers.planning_architecture.strategy = 'made_up_strategy';

    expect(() => parseLayerPoolsConfig(raw)).toThrow(InvalidLayerPoolsConfigError);
  });

  it('throws when "primary_fallback" is missing or not a boolean', () => {
    const raw = validRaw();
    delete raw.layers.planning_architecture.primary_fallback;

    expect(() => parseLayerPoolsConfig(raw)).toThrow(InvalidLayerPoolsConfigError);
  });

  it('throws when "providers" is not a list', () => {
    const raw = validRaw();
    raw.layers.planning_architecture.providers = {};

    expect(() => parseLayerPoolsConfig(raw)).toThrow(InvalidLayerPoolsConfigError);
  });

  it('throws when a provider entry is not a mapping', () => {
    const raw = validRaw();
    raw.layers.planning_architecture.providers = ['nope'];

    expect(() => parseLayerPoolsConfig(raw)).toThrow(InvalidLayerPoolsConfigError);
  });

  it.each(['name', 'provider', 'base_url', 'model'])(
    'throws when a provider is missing required string field "%s"',
    (field) => {
      const raw = validRaw();
      delete firstProvider(raw)[field];

      expect(() => parseLayerPoolsConfig(raw)).toThrow(InvalidLayerPoolsConfigError);
    },
  );

  it.each(['weight', 'priority', 'cost_tier', 'latency_tier'])(
    'throws when optional numeric provider field "%s" is present but not a number',
    (field) => {
      const raw = validRaw();
      firstProvider(raw)[field] = 'not-a-number';

      expect(() => parseLayerPoolsConfig(raw)).toThrow(InvalidLayerPoolsConfigError);
    },
  );
});
