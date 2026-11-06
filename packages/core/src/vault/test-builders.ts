import type { CredentialStorePort, IKeyDerivationPort, RandomBytesPort } from './types.js';

/** Returns a fixed sequence of bytes buffers, cycling a seed so repeated calls stay distinct but deterministic. */
export class FakeRandomBytesPort implements RandomBytesPort {
  private sequence = 0;

  generate(length: number): Buffer {
    this.sequence += 1;
    return Buffer.alloc(length, this.sequence % 256);
  }
}

export class FakeKeyDerivationPort implements IKeyDerivationPort {
  calls = 0;

  constructor(private readonly key: Buffer) {}

  async getOrCreateMasterKey(): Promise<Buffer> {
    this.calls += 1;
    return this.key;
  }
}

/** In-memory CredentialStorePort for tests of callers that depend on the port rather than a concrete vault adapter. */
export class FakeCredentialStorePort implements CredentialStorePort {
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
