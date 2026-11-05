/** A subscription's rate-limit cooldown, per `subscriptions.rate_limit_reset_at`. */
export interface RateLimitState {
  readonly subscriptionId: string;
  readonly resetAtEpochMs: number;
}

export class InvalidCooldownError extends Error {
  constructor(cooldownSeconds: number) {
    super(`cooldownSeconds must be greater than zero, got ${cooldownSeconds}.`);
    this.name = 'InvalidCooldownError';
  }
}
