import type { RateLimitCheckPort } from './types.js';

export class FakeRateLimitCheckPort implements RateLimitCheckPort {
  constructor(private readonly rateLimited: ReadonlySet<string> = new Set()) {}

  isRateLimited(providerName: string): boolean {
    return this.rateLimited.has(providerName);
  }
}
