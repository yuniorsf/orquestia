import { describe, expect, it } from 'vitest';
import { deriveCodeChallenge, generateCodeVerifier, generateState } from './pkce.js';

describe('generateCodeVerifier', () => {
  it('base64url-encodes the given random bytes (no padding, no +/ chars)', () => {
    const verifier = generateCodeVerifier(Buffer.from('a'.repeat(32)));

    expect(verifier).not.toMatch(/[+/=]/);
  });

  it('produces a verifier within the RFC 7636 43-128 char range for 32 random bytes', () => {
    const verifier = generateCodeVerifier(Buffer.alloc(32, 7));

    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
  });
});

describe('deriveCodeChallenge', () => {
  it('is deterministic given the same verifier', () => {
    const verifier = generateCodeVerifier(Buffer.alloc(32, 1));

    expect(deriveCodeChallenge(verifier)).toBe(deriveCodeChallenge(verifier));
  });

  it('produces different challenges for different verifiers', () => {
    const challengeA = deriveCodeChallenge(generateCodeVerifier(Buffer.alloc(32, 1)));
    const challengeB = deriveCodeChallenge(generateCodeVerifier(Buffer.alloc(32, 2)));

    expect(challengeA).not.toBe(challengeB);
  });

  it('matches the known RFC 7636 appendix B test vector', () => {
    // https://datatracker.ietf.org/doc/html/rfc7636#appendix-B
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';

    expect(deriveCodeChallenge(verifier)).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });
});

describe('generateState', () => {
  it('base64url-encodes the given random bytes', () => {
    expect(generateState(Buffer.from('b'.repeat(16)))).not.toMatch(/[+/=]/);
  });
});
