import { DEFAULT_TOKEN_ENDPOINT, postTokenRequest } from './token-request.js';
import type { TokenExchangePort, TokenResponse } from './types.js';

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
    return postTokenRequest(this.tokenEndpoint, {
      grant_type: 'authorization_code',
      client_id: this.clientId,
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    });
  }
}
