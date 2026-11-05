import type { IVaultAuthPort } from './types.js';

/**
 * Static-token auth — the simplest of Vault's auth methods, typically used
 * for service/CI contexts. AppRole/OIDC are separate adapters implementing
 * {@link IVaultAuthPort} in a future ticket.
 */
export class TokenAuthPort implements IVaultAuthPort {
  constructor(private readonly token: string) {}

  async getToken(): Promise<string> {
    return this.token;
  }
}
