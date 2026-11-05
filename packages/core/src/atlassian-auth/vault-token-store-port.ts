import type { CredentialStorePort } from '../vault/types.js';
import type { StoredToken, TokenStorePort } from './types.js';

const DEFAULT_CREDENTIAL_KEY = 'atlassian_oauth_token';

/** Persists the OAuth token as a single JSON-serialized credential in the (already-encrypted) vault — no new storage mechanism needed. */
export class VaultTokenStorePort implements TokenStorePort {
  constructor(
    private readonly credentialStore: CredentialStorePort,
    private readonly credentialKey: string = DEFAULT_CREDENTIAL_KEY,
  ) {}

  async getStoredToken(): Promise<StoredToken | null> {
    const raw = await this.credentialStore.getCredential(this.credentialKey);
    return raw ? (JSON.parse(raw) as StoredToken) : null;
  }

  async saveToken(token: StoredToken): Promise<void> {
    await this.credentialStore.setCredential(this.credentialKey, JSON.stringify(token));
  }
}
