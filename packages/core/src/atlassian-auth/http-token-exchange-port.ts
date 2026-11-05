import { TokenExchangeError, type TokenExchangePort, type TokenResponse } from './types.js';

interface AtlassianTokenResponse {
  readonly access_token: string;
  readonly refresh_token: string;
  readonly expires_in: number;
  readonly scope: string;
}

const DEFAULT_TOKEN_ENDPOINT = 'https://auth.atlassian.com/oauth/token';

/** Exchanges the authorization code for tokens via Atlassian's OAuth token endpoint. */
export class HttpTokenExchangePort implements TokenExchangePort {
  constructor(
    private readonly clientId: string,
    private readonly tokenEndpoint: string = DEFAULT_TOKEN_ENDPOINT,
  ) {}

  async exchangeCodeForTokens(
    code: string,
    codeVerifier: string,
    redirectUri: string,
  ): Promise<TokenResponse> {
    const response = await fetch(this.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: this.clientId,
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    });

    if (!response.ok) {
      throw new TokenExchangeError(response.status, await response.text());
    }

    const body = (await response.json()) as AtlassianTokenResponse;
    return {
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      expiresInSeconds: body.expires_in,
      scope: body.scope,
    };
  }
}
