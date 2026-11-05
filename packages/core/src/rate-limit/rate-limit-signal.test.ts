import { describe, expect, it } from 'vitest';
import { isRateLimitHttpStatus } from './rate-limit-signal.js';

describe('isRateLimitHttpStatus', () => {
  it('recognizes HTTP 429 Too Many Requests as a rate-limit signal', () => {
    expect(isRateLimitHttpStatus(429)).toBe(true);
  });

  it('does not treat other HTTP statuses as a rate-limit signal', () => {
    expect(isRateLimitHttpStatus(200)).toBe(false);
    expect(isRateLimitHttpStatus(500)).toBe(false);
  });
});
