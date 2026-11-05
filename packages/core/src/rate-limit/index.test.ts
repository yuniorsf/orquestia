import { describe, expect, it } from 'vitest';
import * as rateLimit from './index.js';

describe('rate-limit public API', () => {
  it('exports the tracker and the HTTP 429 signal detector', () => {
    expect(rateLimit.RateLimitTracker).toBeTypeOf('function');
    expect(rateLimit.isRateLimitHttpStatus).toBeTypeOf('function');
  });

  it('exports the invalid cooldown domain error type', () => {
    expect(rateLimit.InvalidCooldownError).toBeTypeOf('function');
  });
});
