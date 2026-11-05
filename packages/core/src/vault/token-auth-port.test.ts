import { describe, expect, it } from 'vitest';
import { TokenAuthPort } from './token-auth-port.js';

describe('TokenAuthPort', () => {
  it('returns the configured token', async () => {
    const port = new TokenAuthPort('my-static-token');

    expect(await port.getToken()).toBe('my-static-token');
  });
});
