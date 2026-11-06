import type { CredentialStorePort } from '@orquestia/core';
import { describe, expect, it } from 'vitest';
import { AuthCommand } from './auth-command.js';

class FakeCredentialStorePort implements CredentialStorePort {
  private readonly values = new Map<string, string>();

  constructor(seed: Readonly<Record<string, string>> = {}) {
    for (const [key, value] of Object.entries(seed)) {
      this.values.set(key, value);
    }
  }

  async getCredential(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async setCredential(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async deleteCredential(key: string): Promise<void> {
    this.values.delete(key);
  }

  async listCredentialKeys(): Promise<readonly string[]> {
    return [...this.values.keys()].sort();
  }
}

describe('AuthCommand', () => {
  it('reports usage for an unknown action', async () => {
    const command = new AuthCommand(new FakeCredentialStorePort());

    const result = await command.run(['bogus']);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Usage: orquestia auth <store|get|rotate|list>');
  });

  describe('store', () => {
    it('stores a credential', async () => {
      const store = new FakeCredentialStorePort();
      const command = new AuthCommand(store);

      const result = await command.run(['store', 'api-key', 'sk-secret-value']);

      expect(result).toEqual({ exitCode: 0, stdout: 'Stored credential "api-key".\n', stderr: '' });
      expect(await store.getCredential('api-key')).toBe('sk-secret-value');
    });

    it('rejects a missing key or value', async () => {
      const command = new AuthCommand(new FakeCredentialStorePort());

      expect((await command.run(['store'])).exitCode).toBe(1);
      expect((await command.run(['store', 'key-only'])).exitCode).toBe(1);
    });
  });

  describe('get', () => {
    it('masks the value by default', async () => {
      const store = new FakeCredentialStorePort({ 'api-key': 'sk-secret-value' });
      const command = new AuthCommand(store);

      const result = await command.run(['get', 'api-key']);

      expect(result).toEqual({ exitCode: 0, stdout: 'sk***********ue\n', stderr: '' });
    });

    it('masks a short value entirely', async () => {
      const store = new FakeCredentialStorePort({ pin: '12' });
      const command = new AuthCommand(store);

      const result = await command.run(['get', 'pin']);

      expect(result.stdout).toBe('**\n');
    });

    it('reveals the full value with --reveal', async () => {
      const store = new FakeCredentialStorePort({ 'api-key': 'sk-secret-value' });
      const command = new AuthCommand(store);

      const result = await command.run(['get', 'api-key', '--reveal']);

      expect(result.stdout).toBe('sk-secret-value\n');
    });

    it('reports a missing key argument', async () => {
      const command = new AuthCommand(new FakeCredentialStorePort());

      const result = await command.run(['get']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Usage: orquestia auth get <key>');
    });

    it('reports when no credential is stored for the key', async () => {
      const command = new AuthCommand(new FakeCredentialStorePort());

      const result = await command.run(['get', 'missing']);

      expect(result).toEqual({
        exitCode: 1,
        stdout: '',
        stderr: 'No credential stored for "missing".\n',
      });
    });
  });

  describe('rotate', () => {
    it('replaces an existing credential value', async () => {
      const store = new FakeCredentialStorePort({ 'api-key': 'old-value' });
      const command = new AuthCommand(store);

      const result = await command.run(['rotate', 'api-key', 'new-value']);

      expect(result).toEqual({
        exitCode: 0,
        stdout: 'Rotated credential "api-key".\n',
        stderr: '',
      });
      expect(await store.getCredential('api-key')).toBe('new-value');
    });

    it('refuses to rotate a credential that was never stored', async () => {
      const store = new FakeCredentialStorePort();
      const command = new AuthCommand(store);

      const result = await command.run(['rotate', 'never-set', 'new-value']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Cannot rotate "never-set"');
      expect(await store.getCredential('never-set')).toBeNull();
    });

    it('rejects a missing key or value', async () => {
      const command = new AuthCommand(new FakeCredentialStorePort());

      expect((await command.run(['rotate'])).exitCode).toBe(1);
      expect((await command.run(['rotate', 'key-only'])).exitCode).toBe(1);
    });
  });

  describe('list', () => {
    it('lists stored credential keys, one per line', async () => {
      const store = new FakeCredentialStorePort({ zebra: '1', alpha: '2' });
      const command = new AuthCommand(store);

      const result = await command.run(['list']);

      expect(result).toEqual({ exitCode: 0, stdout: 'alpha\nzebra\n', stderr: '' });
    });

    it('reports when no credentials are stored', async () => {
      const command = new AuthCommand(new FakeCredentialStorePort());

      const result = await command.run(['list']);

      expect(result).toEqual({ exitCode: 0, stdout: 'No credentials stored.\n', stderr: '' });
    });
  });
});
