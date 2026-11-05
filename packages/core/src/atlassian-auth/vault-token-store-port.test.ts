import { describe, expect, it } from 'vitest';
import { FakeCredentialStorePort } from '../vault/test-builders.js';
import { VaultTokenStorePort } from './vault-token-store-port.js';

const token = { accessToken: 'access-abc', refreshToken: 'refresh-abc', expiresAtEpochMs: 123_000 };

describe('VaultTokenStorePort', () => {
  it('returns null when no token has been stored yet', async () => {
    const store = new VaultTokenStorePort(new FakeCredentialStorePort());

    expect(await store.getStoredToken()).toBeNull();
  });

  it('round-trips a stored token as JSON under the default credential key', async () => {
    const credentialStore = new FakeCredentialStorePort();
    const store = new VaultTokenStorePort(credentialStore);

    await store.saveToken(token);

    expect(await store.getStoredToken()).toEqual(token);
    expect(await credentialStore.getCredential('atlassian_oauth_token')).toBe(
      JSON.stringify(token),
    );
  });

  it('uses a custom credential key when given', async () => {
    const credentialStore = new FakeCredentialStorePort();
    const store = new VaultTokenStorePort(credentialStore, 'custom_key');

    await store.saveToken(token);

    expect(await credentialStore.getCredential('custom_key')).toBe(JSON.stringify(token));
    expect(await credentialStore.getCredential('atlassian_oauth_token')).toBeNull();
  });

  it('removes a stored token when the underlying credential is deleted', async () => {
    const credentialStore = new FakeCredentialStorePort();
    const store = new VaultTokenStorePort(credentialStore);
    await store.saveToken(token);

    await credentialStore.deleteCredential('atlassian_oauth_token');

    expect(await store.getStoredToken()).toBeNull();
  });
});
