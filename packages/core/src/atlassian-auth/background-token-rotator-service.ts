import type { Clock } from '../shared/clock.js';
import type { StoredToken, TokenRefreshPort, TokenStorePort } from './types.js';

/** Renew 5 minutes before expiration, per the ticket's spec. */
export const REFRESH_LEAD_TIME_MS = 5 * 60 * 1000;

/**
 * Core rotation decision logic: checks the stored token's absolute
 * expiry against the current time and refreshes it (persisting the
 * new token) when within — or past — the lead time. The actual
 * recurring schedule is a thin adapter-level concern
 * (`IntervalTokenRotationScheduler`) that calls this on a cadence;
 * this service is pure orchestration, fully testable without timers.
 */
export class BackgroundTokenRotatorService {
  constructor(
    private readonly tokenStore: TokenStorePort,
    private readonly tokenRefresh: TokenRefreshPort,
    private readonly clock: Clock,
  ) {}

  async checkAndRotateIfNeeded(): Promise<StoredToken | null> {
    const stored = await this.tokenStore.getStoredToken();
    if (!stored) {
      return null;
    }

    const refreshDueAt = stored.expiresAtEpochMs - REFRESH_LEAD_TIME_MS;
    if (this.clock.now() < refreshDueAt) {
      return stored;
    }

    const refreshed = await this.tokenRefresh.refresh(stored.refreshToken);
    const rotated: StoredToken = {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      expiresAtEpochMs: this.clock.now() + refreshed.expiresInSeconds * 1000,
    };
    await this.tokenStore.saveToken(rotated);
    return rotated;
  }
}
