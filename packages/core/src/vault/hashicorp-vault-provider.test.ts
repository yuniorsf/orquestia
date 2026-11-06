import { type ChildProcess, execSync, spawn } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FakeClock, FakeTokenGenerator } from '../approvals/test-builders.js';
import { HashiCorpVaultProvider } from './hashicorp-vault-provider.js';
import { TokenAuthPort } from './token-auth-port.js';
import { VaultHttpError } from './types.js';

const PORT = 18789;
const ROOT_TOKEN = 'orquestia-test-root-token';
const VAULT_ADDR = `http://127.0.0.1:${PORT}`;

function hasVaultCli(): boolean {
  try {
    execSync('vault version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function waitForVaultReady(): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${VAULT_ADDR}/v1/sys/health`);
      if (response.status === 200) {
        return;
      }
    } catch {
      // Server socket not open yet — keep polling.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error('Vault dev server did not become ready in time.');
}

/**
 * Exercises the real HashiCorp Vault HTTP API against a throwaway `vault
 * server -dev` instance (in-memory, unsealed by default, KV v2 already
 * mounted at `secret/`) — the same "real but disposable infrastructure"
 * pattern as `GitWorktreeProvisioner`/`GitStashCheckpoint` against real
 * git and `MacosKeychainKeyDerivationPort` against a disposable Keychain.
 * Skipped when the `vault` CLI isn't installed.
 */
describe.skipIf(!hasVaultCli())('HashiCorpVaultProvider', () => {
  let vaultProcess: ChildProcess;

  beforeAll(async () => {
    vaultProcess = spawn(
      'vault',
      [
        'server',
        '-dev',
        `-dev-root-token-id=${ROOT_TOKEN}`,
        `-dev-listen-address=127.0.0.1:${PORT}`,
      ],
      { stdio: 'ignore' },
    );
    await waitForVaultReady();
  });

  afterAll(() => {
    vaultProcess.kill();
  });

  function createProvider(auth = new TokenAuthPort(ROOT_TOKEN)): {
    provider: HashiCorpVaultProvider;
    clock: FakeClock;
  } {
    const clock = new FakeClock(1_000);
    const provider = new HashiCorpVaultProvider(VAULT_ADDR, auth, clock, new FakeTokenGenerator());
    return { provider, clock };
  }

  describe('credentials', () => {
    it('returns null for a credential that was never set', async () => {
      const { provider } = createProvider();

      expect(await provider.getCredential('never-set')).toBeNull();
    });

    it('round-trips a credential', async () => {
      const { provider } = createProvider();

      await provider.setCredential('api-key', 'sk-abc-123');

      expect(await provider.getCredential('api-key')).toBe('sk-abc-123');
    });

    it('overwrites an existing credential value on re-set', async () => {
      const { provider } = createProvider();

      await provider.setCredential('overwrite-key', 'first-value');
      await provider.setCredential('overwrite-key', 'second-value');

      expect(await provider.getCredential('overwrite-key')).toBe('second-value');
    });

    it('deletes a credential so later reads return null', async () => {
      const { provider } = createProvider();
      await provider.setCredential('delete-key', 'sk-abc-123');

      await provider.deleteCredential('delete-key');

      expect(await provider.getCredential('delete-key')).toBeNull();
    });

    it('treats deleting a credential that was never set as a no-op', async () => {
      const { provider } = createProvider();

      await expect(provider.deleteCredential('was-never-set')).resolves.toBeUndefined();
    });

    it('lists stored credential keys', async () => {
      const { provider } = createProvider();
      await provider.setCredential('list-a', '1');
      await provider.setCredential('list-b', '2');

      const keys = await provider.listCredentialKeys();

      expect(keys).toContain('list-a');
      expect(keys).toContain('list-b');
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
        id: 'sub-hashi-1',
        planName: 'pro',
        status: 'active',
        renewsAt: null,
      });
      await provider.upsertSubscription({
        id: 'sub-hashi-2',
        planName: 'team',
        status: 'active',
        renewsAt: 2_000,
      });

      const subscriptions = await provider.listSubscriptions();

      expect(subscriptions).toEqual(
        expect.arrayContaining([
          { id: 'sub-hashi-1', planName: 'pro', status: 'active', renewsAt: null },
          { id: 'sub-hashi-2', planName: 'team', status: 'active', renewsAt: 2_000 },
        ]),
      );
    });

    it('updates an existing subscription on re-upsert rather than duplicating it', async () => {
      const { provider } = createProvider();
      await provider.upsertSubscription({
        id: 'sub-hashi-3',
        planName: 'pro',
        status: 'active',
        renewsAt: 1_000,
      });

      await provider.upsertSubscription({
        id: 'sub-hashi-3',
        planName: 'pro',
        status: 'canceled',
        renewsAt: null,
      });

      const subscriptions = await provider.listSubscriptions();
      expect(subscriptions.filter((s) => s.id === 'sub-hashi-3')).toEqual([
        { id: 'sub-hashi-3', planName: 'pro', status: 'canceled', renewsAt: null },
      ]);
    });
  });

  describe('agent access audit', () => {
    it('records and lists audit entries for a given agent, ordered by timestamp', async () => {
      const { provider, clock } = createProvider();

      clock.advanceTo(10);
      await provider.recordAgentAccess({
        agentId: 'hashi-agent-1',
        resource: 'vault:api-key',
        action: 'read',
        timestamp: 10,
      });
      clock.advanceTo(20);
      await provider.recordAgentAccess({
        agentId: 'hashi-agent-1',
        resource: 'vault:api-key',
        action: 'write',
        timestamp: 20,
      });
      await provider.recordAgentAccess({
        agentId: 'hashi-agent-2',
        resource: 'vault:other',
        action: 'read',
        timestamp: 15,
      });

      const entries = await provider.listAgentAccessAudit('hashi-agent-1');

      expect(entries).toHaveLength(2);
      expect(entries.map((entry) => entry.action)).toEqual(['read', 'write']);
      expect(entries.every((entry) => entry.agentId === 'hashi-agent-1')).toBe(true);
    });

    it('returns an empty list for an agent with no recorded access', async () => {
      const { provider } = createProvider();

      expect(await provider.listAgentAccessAudit('never-accessed-agent')).toEqual([]);
    });
  });

  describe('auth failures', () => {
    it('throws VaultHttpError when the token is rejected', async () => {
      const { provider } = createProvider(new TokenAuthPort('not-a-real-token'));

      await expect(provider.setCredential('x', 'y')).rejects.toThrow(VaultHttpError);
    });
  });
});
