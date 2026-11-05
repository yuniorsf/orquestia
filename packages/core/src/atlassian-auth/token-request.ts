import { TokenExchangeError, type TokenResponse } from './types.js';

interface AtlassianTokenResponse {
  readonly access_token: string;
  readonly refresh_token: string;
  readonly expires_in: number;
  readonly scope: string;
}

export const DEFAULT_TOKEN_ENDPOINT = 'https://auth.atlassian.com/oauth/token';

/** Shared POST-and-parse logic for Atlassian's token endpoint (used by both the authorization-code exchange and the refresh-token grant). */
export async function postTokenRequest(
  tokenEndpoint: string,
  body: Readonly<Record<string, string>>,
): Promise<TokenResponse> {
  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new TokenExchangeError(response.status, await response.text());
  }

  const parsed = (await response.json()) as AtlassianTokenResponse;
  return {
    accessToken: parsed.access_token,
    refreshToken: parsed.refresh_token,
    expiresInSeconds: parsed.expires_in,
    scope: parsed.scope,
  };
}
