import { describe, expect, it } from 'vitest';
import { FakeClock, FakeTokenGenerator } from '../approvals/test-builders.js';
import { SQLCipherVaultProvider } from './sqlcipher-vault-provider.js';
import { FakeKeyDerivationPort, FakeRandomBytesPort } from './test-builders.js';
import { VAULT_KEY_LENGTH_BYTES } from './vault-crypto.js';

function createProvider(): {
  provider: SQLCipherVaultProvider;
  keyDerivation: FakeKeyDerivationPort;
  clock: FakeClock;
} {
  const keyDerivation = new FakeKeyDerivationPort(Buffer.alloc(VAULT_KEY_LENGTH_BYTES, 7));
  const clock = new FakeClock(1_000);
  const provider = new SQLCipherVaultProvider(
    ':memory:',
    keyDerivation,
    new FakeRandomBytesPort(),
    clock,
    new FakeTokenGenerator(),
  );
  return { provider, keyDerivation, clock };
}

describe('SQLCipherVaultProvider', () => {
  describe('credentials', () => {
    it('returns null for a credential that was never set', async () => {
      const { provider } = createProvider();

      expect(await provider.getCredential('missing')).toBeNull();
    });

    it('round-trips an encrypted credential', async () => {
      const { provider } = createProvider();

      await provider.setCredential('api-key', 'sk-abc-123');

      expect(await provider.getCredential('api-key')).toBe('sk-abc-123');
    });

    it('overwrites an existing credential value on re-set (upsert)', async () => {
      const { provider } = createProvider();

      await provider.setCredential('api-key', 'first-value');
      await provider.setCredential('api-key', 'second-value');

      expect(await provider.getCredential('api-key')).toBe('second-value');
    });

    it('deletes a credential so later reads return null', async () => {
      const { provider } = createProvider();
      await provider.setCredential('api-key', 'sk-abc-123');

      await provider.deleteCredential('api-key');

      expect(await provider.getCredential('api-key')).toBeNull();
    });

    it('derives the master key at most once across multiple operations', async () => {
      const { provider, keyDerivation } = createProvider();

      await provider.setCredential('a', '1');
      await provider.setCredential('b', '2');
      await provider.getCredential('a');

      expect(keyDerivation.calls).toBe(1);
    });
  });

  describe('subscriptions', () => {
    it('returns an empty list when none exist', async () => {
      const { provider } = createProvider();

      expect(await provider.listSubscriptions()).toEqual([]);
    });

    it('upserts and lists subscriptions, including a null renewsAt', async () => {
      const { provider } = createProvider();

      await provider.upsertSubscription({
        id: 'sub-1',
        planName: 'pro',
        status: 'active',
        renewsAt: null,
      });
      await provider.upsertSubscription({
        id: 'sub-2',
        planName: 'team',
        status: 'active',
        renewsAt: 2_000,
      });

      expect(await provider.listSubscriptions()).toEqual([
        { id: 'sub-1', planName: 'pro', status: 'active', renewsAt: null },
        { id: 'sub-2', planName: 'team', status: 'active', renewsAt: 2_000 },
      ]);
    });

    it('updates an existing subscription on conflict rather than duplicating it', async () => {
      const { provider } = createProvider();
      await provider.upsertSubscription({
        id: 'sub-1',
        planName: 'pro',
        status: 'active',
        renewsAt: 1_000,
      });

      await provider.upsertSubscription({
        id: 'sub-1',
        planName: 'pro',
        status: 'canceled',
        renewsAt: null,
      });

      expect(await provider.listSubscriptions()).toEqual([
        { id: 'sub-1', planName: 'pro', status: 'canceled', renewsAt: null },
      ]);
    });
  });

  describe('agent access audit', () => {
    it('records and lists audit entries for a given agent, ordered by timestamp', async () => {
      const { provider, clock } = createProvider();

      clock.advanceTo(10);
      await provider.recordAgentAccess({
        agentId: 'agent-1',
        resource: 'vault:api-key',
        action: 'read',
        timestamp: 10,
      });
      clock.advanceTo(20);
      await provider.recordAgentAccess({
        agentId: 'agent-1',
        resource: 'vault:api-key',
        action: 'write',
        timestamp: 20,
      });
      await provider.recordAgentAccess({
        agentId: 'agent-2',
        resource: 'vault:other',
        action: 'read',
        timestamp: 15,
      });

      const entries = await provider.listAgentAccessAudit('agent-1');

      expect(entries).toHaveLength(2);
      expect(entries.map((entry) => entry.action)).toEqual(['read', 'write']);
      expect(entries.every((entry) => entry.agentId === 'agent-1')).toBe(true);
    });

    it('returns an empty list for an agent with no recorded access', async () => {
      const { provider } = createProvider();

      expect(await provider.listAgentAccessAudit('unknown-agent')).toEqual([]);
    });
  });

  it('closes without throwing when the database was never opened', () => {
    const { provider } = createProvider();

    expect(() => provider.close()).not.toThrow();
  });

  it('closes without throwing after the database has been opened', async () => {
    const { provider } = createProvider();
    await provider.setCredential('a', '1');

    expect(() => provider.close()).not.toThrow();
  });
});
