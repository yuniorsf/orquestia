import { describe, expect, it } from 'vitest';
import { FakeCredentialStorePort } from './test-builders.js';

describe('FakeCredentialStorePort.listCredentialKeys', () => {
  it('returns the seeded keys in sorted order', async () => {
    const store = new FakeCredentialStorePort({ zebra: '1', alpha: '2' });

    expect(await store.listCredentialKeys()).toEqual(['alpha', 'zebra']);
  });

  it('reflects deletions', async () => {
    const store = new FakeCredentialStorePort({ a: '1' });
    await store.deleteCredential('a');

    expect(await store.listCredentialKeys()).toEqual([]);
  });
});
