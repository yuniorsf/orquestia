import type { Clock } from '../shared/clock.js';
import { InvalidCooldownError, type RateLimitState } from './types.js';

/**
 * Tracks per-subscription rate-limit cooldowns (HTTP 429 / CLI quota
 * exhaustion) so a `quota_aware` Strategy Router can shift traffic away
 * from an exhausted subscription and automatically resume it once its
 * cooldown elapses — purely by comparing the injected Clock against the
 * recorded `resetAtEpochMs`, with no explicit "resume" call needed.
 */
export class RateLimitTracker {
  private readonly cooldowns = new Map<string, number>();

  constructor(private readonly clock: Clock) {}

  markRateLimited(subscriptionId: string, cooldownSeconds: number): RateLimitState {
    if (cooldownSeconds <= 0) {
      throw new InvalidCooldownError(cooldownSeconds);
    }

    const resetAtEpochMs = this.clock.now() + cooldownSeconds * 1000;
    this.cooldowns.set(subscriptionId, resetAtEpochMs);
    return { subscriptionId, resetAtEpochMs };
  }

  isRateLimited(subscriptionId: string): boolean {
    return this.activeResetAt(subscriptionId) !== null;
  }

  getResetAt(subscriptionId: string): number | null {
    return this.activeResetAt(subscriptionId);
  }

  listRateLimited(): readonly string[] {
    return [...this.cooldowns.keys()].filter((subscriptionId) =>
      this.isRateLimited(subscriptionId),
    );
  }

  private activeResetAt(subscriptionId: string): number | null {
    const resetAtEpochMs = this.cooldowns.get(subscriptionId);
    if (resetAtEpochMs === undefined) {
      return null;
    }

    if (this.clock.now() >= resetAtEpochMs) {
      this.cooldowns.delete(subscriptionId);
      return null;
    }

    return resetAtEpochMs;
  }
}
