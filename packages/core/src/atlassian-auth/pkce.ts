import { createHash } from 'node:crypto';

/** 32 random bytes → 43 base64url chars, within RFC 7636's 43-128 char range. */
export const CODE_VERIFIER_BYTE_LENGTH = 32;
/** 16 random bytes is ample entropy for the CSRF-protection `state` param. */
export const STATE_BYTE_LENGTH = 16;

/** Pure given its random input — the randomness itself is injected via RandomBytesPort at the call site. */
export function generateCodeVerifier(randomBytes: Buffer): string {
  return base64UrlEncode(randomBytes);
}

/** RFC 7636 S256 transform: BASE64URL(SHA256(code_verifier)). */
export function deriveCodeChallenge(codeVerifier: string): string {
  const hash = createHash('sha256').update(codeVerifier).digest();
  return base64UrlEncode(hash);
}

export function generateState(randomBytes: Buffer): string {
  return base64UrlEncode(randomBytes);
}

function base64UrlEncode(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
