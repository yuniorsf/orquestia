import { describe, expect, it } from 'vitest';
import { DurableApprovalManager } from './durable-approval-manager.js';
import { UnknownApprovalRecordError, InvalidApprovalTokenError } from './types.js';
import {
  FakeClock,
  FakeTokenGenerator,
  InMemoryApprovalStateStore,
  defaultGateModes,
} from './test-builders.js';

function createManager(clock = new FakeClock(1_000)) {
  const store = new InMemoryApprovalStateStore();
  const tokens = new FakeTokenGenerator();
  const manager = new DurableApprovalManager(store, clock, tokens, defaultGateModes);
  return { manager, store, clock, tokens };
}

describe('DurableApprovalManager.requestGate', () => {
  it('auto-approves gates configured with mode "auto"', async () => {
    const { manager, clock } = createManager();

    const record = await manager.requestGate('task-1', 'after_planning');

    expect(record.decision).toBe('approved');
    expect(record.mode).toBe('auto');
    expect(record.resolvedAt).toBe(clock.now());
    expect(record.token).toBeNull();
  });

  it('leaves "prompt" gates pending with no token', async () => {
    const { manager } = createManager();

    const record = await manager.requestGate('task-1', 'before_coding');

    expect(record.decision).toBe('pending');
    expect(record.resolvedAt).toBeNull();
    expect(record.token).toBeNull();
  });

  it('issues a token for "manual_token" gates and leaves them pending', async () => {
    const { manager } = createManager();

    const record = await manager.requestGate('task-1', 'before_ship');

    expect(record.decision).toBe('pending');
    expect(record.mode).toBe('manual_token');
    expect(record.token).toBe('fake-token-1');
  });

  it('is idempotent: re-requesting the same gate returns the existing record', async () => {
    const { manager } = createManager();

    const first = await manager.requestGate('task-1', 'before_coding');
    const second = await manager.requestGate('task-1', 'before_coding');

    expect(second).toEqual(first);
  });
});

describe('DurableApprovalManager.approve', () => {
  it('throws UnknownApprovalRecordError when no gate was requested', async () => {
    const { manager } = createManager();

    await expect(manager.approve('task-1', 'before_coding')).rejects.toThrow(
      UnknownApprovalRecordError,
    );
  });

  it('approves a pending "prompt" gate without requiring a token', async () => {
    const { manager, clock } = createManager();
    await manager.requestGate('task-1', 'before_coding');
    clock.advanceTo(2_000);

    const resolved = await manager.approve('task-1', 'before_coding');

    expect(resolved.decision).toBe('approved');
    expect(resolved.resolvedAt).toBe(2_000);
    expect(await manager.isApproved('task-1', 'before_coding')).toBe(true);
  });

  it('rejects approval of a "manual_token" gate with a missing token', async () => {
    const { manager } = createManager();
    await manager.requestGate('task-1', 'before_ship');

    await expect(manager.approve('task-1', 'before_ship')).rejects.toThrow(
      InvalidApprovalTokenError,
    );
  });

  it('rejects approval of a "manual_token" gate with a mismatched token', async () => {
    const { manager } = createManager();
    await manager.requestGate('task-1', 'before_ship');

    await expect(manager.approve('task-1', 'before_ship', 'wrong-token')).rejects.toThrow(
      InvalidApprovalTokenError,
    );
  });

  it('approves a "manual_token" gate when the matching token is supplied', async () => {
    const { manager } = createManager();
    const requested = await manager.requestGate('task-1', 'before_ship');

    const resolved = await manager.approve('task-1', 'before_ship', requested.token ?? undefined);

    expect(resolved.decision).toBe('approved');
  });

  it('is idempotent: approving an already-resolved record returns it unchanged', async () => {
    const { manager } = createManager();
    const approved = await manager.requestGate('task-1', 'after_planning');

    const resolved = await manager.approve('task-1', 'after_planning');

    expect(resolved).toEqual(approved);
  });

  it('leaves other gates for the same task untouched when resolving one', async () => {
    const { manager } = createManager();
    await manager.requestGate('task-1', 'before_coding');
    await manager.requestGate('task-1', 'before_ship');

    await manager.approve('task-1', 'before_coding');

    const stillPending = await manager.listPending('task-1');
    expect(stillPending.map((record) => record.gate)).toEqual(['before_ship']);
  });
});

describe('DurableApprovalManager.reject', () => {
  it('throws UnknownApprovalRecordError when no gate was requested', async () => {
    const { manager } = createManager();

    await expect(manager.reject('task-1', 'before_coding')).rejects.toThrow(
      UnknownApprovalRecordError,
    );
  });

  it('transitions a pending gate to "rejected"', async () => {
    const { manager, clock } = createManager();
    await manager.requestGate('task-1', 'before_coding');
    clock.advanceTo(3_000);

    const resolved = await manager.reject('task-1', 'before_coding');

    expect(resolved.decision).toBe('rejected');
    expect(resolved.resolvedAt).toBe(3_000);
    expect(await manager.isApproved('task-1', 'before_coding')).toBe(false);
  });
});

describe('DurableApprovalManager.isApproved', () => {
  it('returns false when the gate was never requested', async () => {
    const { manager } = createManager();

    expect(await manager.isApproved('task-1', 'before_ship')).toBe(false);
  });
});

describe('DurableApprovalManager.listPending', () => {
  it('returns only pending records scoped to the given task', async () => {
    const { manager } = createManager();
    await manager.requestGate('task-1', 'before_coding');
    await manager.requestGate('task-1', 'before_ship');
    await manager.requestGate('task-2', 'before_coding');
    await manager.requestGate('task-1', 'after_planning');

    const pending = await manager.listPending('task-1');

    expect(pending.map((record) => record.gate).sort()).toEqual(['before_coding', 'before_ship']);
  });

  it('returns an empty list when nothing is pending for the task', async () => {
    const { manager } = createManager();

    expect(await manager.listPending('task-1')).toEqual([]);
  });
});
