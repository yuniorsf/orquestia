import { describe, expect, it } from 'vitest';
import * as loadBalancer from './index.js';

describe('load-balancer public API', () => {
  it('exports the router and balancer classes', () => {
    expect(loadBalancer.DefaultStrategyRouter).toBeTypeOf('function');
    expect(loadBalancer.LayerLoadBalancer).toBeTypeOf('function');
  });

  it('exports the domain error types', () => {
    expect(loadBalancer.UnknownLayerError).toBeTypeOf('function');
    expect(loadBalancer.DisabledLayerError).toBeTypeOf('function');
    expect(loadBalancer.NoProvidersAvailableError).toBeTypeOf('function');
    expect(loadBalancer.UnknownStrategyError).toBeTypeOf('function');
  });
});
