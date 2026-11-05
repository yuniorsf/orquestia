import { describe, expect, it } from 'vitest';
import { RateLimitTracker } from './rate-limit-tracker.js';
import { FakeClock } from './test-builders.js';
import { InvalidCooldownError } from './types.js';

describe('RateLimitTracker.markRateLimited', () => {
  it('rejects a zero cooldown', () => {
    const tracker = new RateLimitTracker(new FakeClock(0));

    expect(() => tracker.markRateLimited('claude_pro_account_1', 0)).toThrow(InvalidCooldownError);
  });

  it('rejects a negative cooldown', () => {
    const tracker = new RateLimitTracker(new FakeClock(0));

    expect(() => tracker.markRateLimited('claude_pro_account_1', -5)).toThrow(InvalidCooldownError);
  });

  it('computes resetAtEpochMs as now + cooldownSeconds', () => {
    const clock = new FakeClock(1_000);
    const tracker = new RateLimitTracker(clock);

    const state = tracker.markRateLimited('claude_pro_account_1', 300);

    expect(state).toEqual({ subscriptionId: 'claude_pro_account_1', resetAtEpochMs: 301_000 });
  });
});

describe('RateLimitTracker.isRateLimited', () => {
  it('returns false for a subscription that was never rate-limited', () => {
    const tracker = new RateLimitTracker(new FakeClock(0));

    expect(tracker.isRateLimited('claude_pro_account_1')).toBe(false);
  });

  it('returns true while the cooldown has not yet elapsed', () => {
    const clock = new FakeClock(0);
    const tracker = new RateLimitTracker(clock);
    tracker.markRateLimited('claude_pro_account_1', 300);

    clock.advanceTo(299_999);

    expect(tracker.isRateLimited('claude_pro_account_1')).toBe(true);
  });

  it('auto-resumes (returns false) once the cooldown has elapsed', () => {
    const clock = new FakeClock(0);
    const tracker = new RateLimitTracker(clock);
    tracker.markRateLimited('claude_pro_account_1', 300);

    clock.advanceTo(300_000);

    expect(tracker.isRateLimited('claude_pro_account_1')).toBe(false);
  });
});

describe('RateLimitTracker.getResetAt', () => {
  it('returns null for a subscription that was never rate-limited', () => {
    const tracker = new RateLimitTracker(new FakeClock(0));

    expect(tracker.getResetAt('claude_pro_account_1')).toBeNull();
  });

  it('returns the reset timestamp while still cooling down', () => {
    const clock = new FakeClock(1_000);
    const tracker = new RateLimitTracker(clock);
    tracker.markRateLimited('claude_pro_account_1', 300);

    expect(tracker.getResetAt('claude_pro_account_1')).toBe(301_000);
  });

  it('returns null once the cooldown has elapsed', () => {
    const clock = new FakeClock(0);
    const tracker = new RateLimitTracker(clock);
    tracker.markRateLimited('claude_pro_account_1', 300);

    clock.advanceTo(300_000);

    expect(tracker.getResetAt('claude_pro_account_1')).toBeNull();
  });
});

describe('RateLimitTracker.listRateLimited', () => {
  it('returns an empty list when nothing is rate-limited', () => {
    const tracker = new RateLimitTracker(new FakeClock(0));

    expect(tracker.listRateLimited()).toEqual([]);
  });

  it('lists every subscription currently cooling down', () => {
    const clock = new FakeClock(0);
    const tracker = new RateLimitTracker(clock);
    tracker.markRateLimited('claude_pro_account_1', 300);
    tracker.markRateLimited('copilot_cli', 60);

    expect([...tracker.listRateLimited()].sort()).toEqual(['claude_pro_account_1', 'copilot_cli']);
  });

  it('excludes subscriptions whose cooldown has elapsed', () => {
    const clock = new FakeClock(0);
    const tracker = new RateLimitTracker(clock);
    tracker.markRateLimited('claude_pro_account_1', 60);
    tracker.markRateLimited('copilot_cli', 300);

    clock.advanceTo(60_000);

    expect(tracker.listRateLimited()).toEqual(['copilot_cli']);
  });
});
