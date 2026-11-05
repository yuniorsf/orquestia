/**
 * Atlassian OAuth 2.0 (3LO) + PKCE loopback flow: spawns an ephemeral local
 * HTTP listener to receive the authorization redirect, generates a PKCE
 * code_verifier/code_challenge pair (S256), and exchanges the returned
 * authorization code for access/refresh tokens.
 */
export interface TokenResponse {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresInSeconds: number;
  readonly scope: string;
}

export interface OAuthCallbackResult {
  readonly code: string;
  readonly state: string;
}

/** The ephemeral local listener that receives the single authorization redirect. */
export interface CallbackListenerPort {
  awaitCallback(): Promise<OAuthCallbackResult>;
  stop(): Promise<void>;
}

export interface TokenExchangePort {
  exchangeCodeForTokens(
    code: string,
    codeVerifier: string,
    redirectUri: string,
  ): Promise<TokenResponse>;
}

export class OAuthStateMismatchError extends Error {
  constructor() {
    super(
      'OAuth callback state did not match the request state (possible CSRF or stale callback).',
    );
    this.name = 'OAuthStateMismatchError';
  }
}

export class OAuthCallbackError extends Error {
  constructor(reason: string) {
    super(`OAuth callback reported an error: ${reason}`);
    this.name = 'OAuthCallbackError';
  }
}

export class TokenExchangeError extends Error {
  constructor(status: number, body: string) {
    super(`Atlassian token exchange failed (HTTP ${status}): ${body}`);
    this.name = 'TokenExchangeError';
  }
}
