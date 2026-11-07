import { describe, expect, it } from 'vitest';
import {
  CODING_LAYER_NAME,
  PLANNING_LAYER_NAME,
  resolveAgentRoutingConfig,
} from './agent-routing-resolver.js';
import type { AgentRoutingConfig } from './types.js';
import type { LayerConfig, ProviderEntry } from '../load-balancer/types.js';

const FALLBACK: AgentRoutingConfig = { branch2a: 'claude_code', branch2b: 'copilot_cli' };

function provider(overrides: Partial<ProviderEntry> & { provider: string }): ProviderEntry {
  return {
    name: overrides.provider,
    baseUrl: 'cli://example',
    model: 'example-model',
    ...overrides,
  };
}

function layer(name: string, overrides: Partial<LayerConfig> = {}): LayerConfig {
  return {
    name,
    enabled: true,
    strategy: 'quota_aware',
    primaryFallback: true,
    providers: [],
    ...overrides,
  };
}

describe('resolveAgentRoutingConfig', () => {
  it('falls back to the default when both layers are absent', () => {
    expect(resolveAgentRoutingConfig([], FALLBACK)).toEqual(FALLBACK);
  });

  it('falls back when the matching layer is disabled', () => {
    const layers = [
      layer(PLANNING_LAYER_NAME, {
        enabled: false,
        providers: [provider({ provider: 'antigravity', priority: 1 })],
      }),
    ];

    expect(resolveAgentRoutingConfig(layers, FALLBACK).branch2a).toBe('claude_code');
  });

  it('picks the lowest-priority provider that resolves to a registered agent', () => {
    const layers = [
      layer(PLANNING_LAYER_NAME, {
        providers: [
          provider({ provider: 'claude_code', priority: 2 }),
          provider({ provider: 'antigravity', priority: 1 }),
        ],
      }),
    ];

    expect(resolveAgentRoutingConfig(layers, FALLBACK).branch2a).toBe('antigravity');
  });

  it('translates config provider ids that differ from the domain AgentName literal', () => {
    const layers = [
      layer(CODING_LAYER_NAME, {
        providers: [provider({ provider: 'github_copilot', priority: 1 })],
      }),
    ];

    expect(resolveAgentRoutingConfig(layers, FALLBACK).branch2b).toBe('copilot_cli');
  });

  it('skips a provider with no registered adapter and falls through to the next one', () => {
    const layers = [
      layer(CODING_LAYER_NAME, {
        providers: [
          provider({ provider: 'ollama', priority: 1 }),
          provider({ provider: 'claude_code', priority: 2 }),
        ],
      }),
    ];

    expect(resolveAgentRoutingConfig(layers, FALLBACK).branch2b).toBe('claude_code');
  });

  it('falls back when every provider in the layer is unmapped', () => {
    const layers = [
      layer(CODING_LAYER_NAME, { providers: [provider({ provider: 'ollama', priority: 1 })] }),
    ];

    expect(resolveAgentRoutingConfig(layers, FALLBACK).branch2b).toBe('copilot_cli');
  });

  it('treats a provider with no explicit priority as lowest priority', () => {
    const layers = [
      layer(PLANNING_LAYER_NAME, {
        providers: [
          provider({ provider: 'claude_code' }),
          provider({ provider: 'antigravity', priority: 1 }),
        ],
      }),
    ];

    expect(resolveAgentRoutingConfig(layers, FALLBACK).branch2a).toBe('antigravity');
  });

  it('treats two providers that both omit priority as equal, keeping a stable order', () => {
    const layers = [
      layer(PLANNING_LAYER_NAME, {
        providers: [provider({ provider: 'antigravity' }), provider({ provider: 'claude_code' })],
      }),
    ];

    expect(resolveAgentRoutingConfig(layers, FALLBACK).branch2a).toBe('antigravity');
  });

  it('resolves branch2a and branch2b independently from their own layers', () => {
    const layers = [
      layer(PLANNING_LAYER_NAME, {
        providers: [provider({ provider: 'antigravity', priority: 1 })],
      }),
      layer(CODING_LAYER_NAME, {
        providers: [provider({ provider: 'github_copilot', priority: 1 })],
      }),
    ];

    expect(resolveAgentRoutingConfig(layers, FALLBACK)).toEqual({
      branch2a: 'antigravity',
      branch2b: 'copilot_cli',
    });
  });
});
