import { describe, expect, it } from 'vitest';
import { CryptoRandomBytesPort } from './crypto-random-bytes-port.js';

describe('CryptoRandomBytesPort', () => {
  it('generates a buffer of the requested length', () => {
    expect(new CryptoRandomBytesPort().generate(16)).toHaveLength(16);
  });

  it('generates a different buffer on each call', () => {
    const port = new CryptoRandomBytesPort();

    expect(port.generate(32).equals(port.generate(32))).toBe(false);
  });
});
