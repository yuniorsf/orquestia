import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeClock } from '../approvals/test-builders.js';
import { BackgroundTokenRotatorService } from './background-token-rotator-service.js';
import { IntervalTokenRotationScheduler } from './interval-token-rotation-scheduler.js';
import { FakeTokenRefreshPort, FakeTokenStorePort } from './test-builders.js';
import type { StoredToken } from './types.js';

const stored: StoredToken = {
  accessToken: 'access-current',
  refreshToken: 'refresh-current',
  expiresAtEpochMs: Number.MAX_SAFE_INTEGER, // never due for refresh in this test
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('IntervalTokenRotationScheduler', () => {
  it('calls checkAndRotateIfNeeded on each tick once started', async () => {
    const tokenStore = new FakeTokenStorePort(stored);
    const rotator = new BackgroundTokenRotatorService(
      tokenStore,
      new FakeTokenRefreshPort({
        accessToken: 'x',
        refreshToken: 'y',
        expiresInSeconds: 1,
        scope: '',
      }),
      new FakeClock(0),
    );
    const checkSpy = vi.spyOn(rotator, 'checkAndRotateIfNeeded');
    const scheduler = new IntervalTokenRotationScheduler(rotator, 1_000);

    scheduler.start();
    await vi.advanceTimersByTimeAsync(3_000);

    expect(checkSpy).toHaveBeenCalledTimes(3);
    scheduler.stop();
  });

  it('stops ticking once stop() is called', async () => {
    const rotator = new BackgroundTokenRotatorService(
      new FakeTokenStorePort(stored),
      new FakeTokenRefreshPort({
        accessToken: 'x',
        refreshToken: 'y',
        expiresInSeconds: 1,
        scope: '',
      }),
      new FakeClock(0),
    );
    const checkSpy = vi.spyOn(rotator, 'checkAndRotateIfNeeded');
    const scheduler = new IntervalTokenRotationScheduler(rotator, 1_000);

    scheduler.start();
    await vi.advanceTimersByTimeAsync(1_000);
    scheduler.stop();
    await vi.advanceTimersByTimeAsync(5_000);

    expect(checkSpy).toHaveBeenCalledTimes(1);
  });

  it('treats stop() before start() as a no-op', () => {
    const rotator = new BackgroundTokenRotatorService(
      new FakeTokenStorePort(stored),
      new FakeTokenRefreshPort({
        accessToken: 'x',
        refreshToken: 'y',
        expiresInSeconds: 1,
        scope: '',
      }),
      new FakeClock(0),
    );
    const scheduler = new IntervalTokenRotationScheduler(rotator, 1_000);

    expect(() => scheduler.stop()).not.toThrow();
  });

  it('routes a failed rotation attempt to the onError handler instead of an unhandled rejection', async () => {
    const tokenStore = new FakeTokenStorePort(stored);
    const rotator = new BackgroundTokenRotatorService(
      tokenStore,
      {
        refresh: async () => {
          throw new Error('refresh failed');
        },
      },
      new FakeClock(Number.MAX_SAFE_INTEGER), // forces the refresh branch
    );
    const errors: unknown[] = [];
    const scheduler = new IntervalTokenRotationScheduler(rotator, 1_000, (error) =>
      errors.push(error),
    );

    scheduler.start();
    await vi.advanceTimersByTimeAsync(1_000);
    scheduler.stop();

    expect(errors).toHaveLength(1);
    expect((errors[0] as Error).message).toBe('refresh failed');
  });

  it('silently swallows a failed rotation attempt when no onError handler is given', async () => {
    const rotator = new BackgroundTokenRotatorService(
      new FakeTokenStorePort(stored),
      {
        refresh: async () => {
          throw new Error('refresh failed');
        },
      },
      new FakeClock(Number.MAX_SAFE_INTEGER), // forces the refresh branch
    );
    const scheduler = new IntervalTokenRotationScheduler(rotator, 1_000);

    scheduler.start();
    // No onError handler and no assertion on a thrown rejection here is
    // the point: a failed rotation must not surface as an unhandled
    // rejection or crash the process when the caller hasn't opted in.
    await vi.advanceTimersByTimeAsync(1_000);
    scheduler.stop();
  });
});
