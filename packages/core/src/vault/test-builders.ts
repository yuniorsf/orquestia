import type { IKeyDerivationPort, RandomBytesPort } from './types.js';

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
