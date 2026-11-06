import { describe, expect, it } from 'vitest';
import * as openaiGateway from './index.js';

describe('openai-gateway public API', () => {
  it('exports the real adapter', () => {
    expect(openaiGateway.HttpOpenAiCompatibleGateway).toBeTypeOf('function');
  });

  it('exports the domain error types', () => {
    expect(openaiGateway.GatewayHttpError).toBeTypeOf('function');
    expect(openaiGateway.MalformedGatewayResponseError).toBeTypeOf('function');
  });
});
