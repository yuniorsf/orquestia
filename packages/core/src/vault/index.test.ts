import { describe, expect, it } from 'vitest';
import * as vault from './index.js';

describe('vault public API', () => {
  it('exports the crypto primitives', () => {
    expect(vault.encryptField).toBeTypeOf('function');
    expect(vault.decryptField).toBeTypeOf('function');
    expect(vault.VAULT_KEY_LENGTH_BYTES).toBe(32);
    expect(vault.VAULT_IV_LENGTH_BYTES).toBe(12);
  });

  it('exports the vault domain error types', () => {
    expect(vault.VaultDecryptionError).toBeTypeOf('function');
    expect(vault.VaultHttpError).toBeTypeOf('function');
  });

  it('exports the real adapters', () => {
    expect(vault.CryptoRandomBytesPort).toBeTypeOf('function');
    expect(vault.MacosKeychainKeyDerivationPort).toBeTypeOf('function');
    expect(vault.SQLCipherVaultProvider).toBeTypeOf('function');
    expect(vault.TokenAuthPort).toBeTypeOf('function');
    expect(vault.HashiCorpVaultProvider).toBeTypeOf('function');
  });
});
