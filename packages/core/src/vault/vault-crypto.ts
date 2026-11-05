import { createCipheriv, createDecipheriv } from 'node:crypto';
import { VaultDecryptionError } from './types.js';

const ALGORITHM = 'aes-256-gcm';

/** AES-256-GCM key length in bytes (256 bits). */
export const VAULT_KEY_LENGTH_BYTES = 32;
/** Standard GCM nonce length in bytes (96 bits). */
export const VAULT_IV_LENGTH_BYTES = 12;

export interface EncryptedField {
  readonly iv: Buffer;
  readonly ciphertext: Buffer;
  readonly authTag: Buffer;
}

/**
 * Encrypts a single field. Pure given its inputs — the IV is injected
 * (via {@link RandomBytesPort} at the call site) rather than generated
 * internally, so this function stays deterministic and needs no fakes.
 */
export function encryptField(plaintext: string, key: Buffer, iv: Buffer): EncryptedField {
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return { iv, ciphertext, authTag: cipher.getAuthTag() };
}

/** Decrypts a field encrypted by {@link encryptField}; throws {@link VaultDecryptionError} on tamper/wrong-key. */
export function decryptField(field: EncryptedField, key: Buffer): string {
  try {
    const decipher = createDecipheriv(ALGORITHM, key, field.iv);
    decipher.setAuthTag(field.authTag);
    return Buffer.concat([decipher.update(field.ciphertext), decipher.final()]).toString('utf8');
  } catch {
    throw new VaultDecryptionError();
  }
}
