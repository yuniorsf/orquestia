import { describe, expect, it } from 'vitest';
import { FakeClock } from '../approvals/test-builders.js';
import {
  BackgroundTokenRotatorService,
  REFRESH_LEAD_TIME_MS,
} from './background-token-rotator-service.js';
import { FakeTokenRefreshPort, FakeTokenStorePort } from './test-builders.js';
import type { StoredToken, TokenResponse } from './types.js';

const refreshedTokens: TokenResponse = {
  accessToken: 'access-renewed',
  refreshToken: 'refresh-renewed',
  expiresInSeconds: 3600,
  scope: 'read:jira-work',
};

describe('BackgroundTokenRotatorService.checkAndRotateIfNeeded', () => {
  it('returns null when no token has been stored yet, without attempting a refresh', async () => {
    const tokenRefresh = new FakeTokenRefreshPort(refreshedTokens);
    const service = new BackgroundTokenRotatorService(
      new FakeTokenStorePort(null),
      tokenRefresh,
      new FakeClock(0),
    );

    expect(await service.checkAndRotateIfNeeded()).toBeNull();
    expect(tokenRefresh.calls).toEqual([]);
  });

  it('returns the stored token unchanged when well outside the refresh lead time', async () => {
    const stored: StoredToken = {
      accessToken: 'access-current',
      refreshToken: 'refresh-current',
      expiresAtEpochMs: 1_000_000,
    };
    const tokenRefresh = new FakeTokenRefreshPort(refreshedTokens);
    const clock = new FakeClock(1_000_000 - REFRESH_LEAD_TIME_MS - 1);
    const service = new BackgroundTokenRotatorService(
      new FakeTokenStorePort(stored),
      tokenRefresh,
      clock,
    );

    const result = await service.checkAndRotateIfNeeded();

    expect(result).toEqual(stored);
    expect(tokenRefresh.calls).toEqual([]);
  });

  it('refreshes and persists a new token once within the lead time of expiry', async () => {
    const stored: StoredToken = {
      accessToken: 'access-current',
      refreshToken: 'refresh-current',
      expiresAtEpochMs: 1_000_000,
    };
    const tokenRefresh = new FakeTokenRefreshPort(refreshedTokens);
    const tokenStore = new FakeTokenStorePort(stored);
    const clock = new FakeClock(1_000_000 - REFRESH_LEAD_TIME_MS);
    const service = new BackgroundTokenRotatorService(tokenStore, tokenRefresh, clock);

    const result = await service.checkAndRotateIfNeeded();

    expect(result).toEqual({
      accessToken: 'access-renewed',
      refreshToken: 'refresh-renewed',
      expiresAtEpochMs: clock.now() + refreshedTokens.expiresInSeconds * 1000,
    });
    expect(tokenRefresh.calls).toEqual(['refresh-current']);
    expect(tokenStore.savedTokens).toEqual([result]);
  });

  it('refreshes a token that has already expired', async () => {
    const stored: StoredToken = {
      accessToken: 'access-expired',
      refreshToken: 'refresh-expired',
      expiresAtEpochMs: 1_000_000,
    };
    const tokenRefresh = new FakeTokenRefreshPort(refreshedTokens);
    const clock = new FakeClock(2_000_000);
    const service = new BackgroundTokenRotatorService(
      new FakeTokenStorePort(stored),
      tokenRefresh,
      clock,
    );

    await service.checkAndRotateIfNeeded();

    expect(tokenRefresh.calls).toEqual(['refresh-expired']);
  });
});
