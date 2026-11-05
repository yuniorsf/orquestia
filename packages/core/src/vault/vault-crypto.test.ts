import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  VAULT_IV_LENGTH_BYTES,
  VAULT_KEY_LENGTH_BYTES,
  decryptField,
  encryptField,
} from './vault-crypto.js';
import { VaultDecryptionError } from './types.js';

const key = randomBytes(VAULT_KEY_LENGTH_BYTES);
const iv = randomBytes(VAULT_IV_LENGTH_BYTES);

describe('encryptField / decryptField', () => {
  it('round-trips plaintext through encryption and decryption', () => {
    const encrypted = encryptField('super-secret-value', key, iv);

    expect(decryptField(encrypted, key)).toBe('super-secret-value');
  });

  it('produces ciphertext that does not equal the plaintext', () => {
    const encrypted = encryptField('super-secret-value', key, iv);

    expect(encrypted.ciphertext.toString('utf8')).not.toBe('super-secret-value');
  });

  it('throws VaultDecryptionError when the wrong key is used', () => {
    const encrypted = encryptField('super-secret-value', key, iv);
    const wrongKey = randomBytes(VAULT_KEY_LENGTH_BYTES);

    expect(() => decryptField(encrypted, wrongKey)).toThrow(VaultDecryptionError);
  });

  it('throws VaultDecryptionError when the ciphertext has been tampered with', () => {
    const encrypted = encryptField('super-secret-value', key, iv);
    const tampered = { ...encrypted, ciphertext: Buffer.from(encrypted.ciphertext) };
    tampered.ciphertext[0] = tampered.ciphertext[0]! ^ 0xff;

    expect(() => decryptField(tampered, key)).toThrow(VaultDecryptionError);
  });
});
