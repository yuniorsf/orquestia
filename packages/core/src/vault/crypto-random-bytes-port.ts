import { randomBytes } from 'node:crypto';
import type { RandomBytesPort } from './types.js';

export class CryptoRandomBytesPort implements RandomBytesPort {
  generate(length: number): Buffer {
    return randomBytes(length);
  }
}
