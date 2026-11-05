import { DEFAULT_TOKEN_ENDPOINT, postTokenRequest } from './token-request.js';
import type { TokenRefreshPort, TokenResponse } from './types.js';

/** Renews an expiring access token via Atlassian's OAuth refresh_token grant. */
export class HttpTokenRefreshPort implements TokenRefreshPort {
  constructor(
    private readonly clientId: string,
    private readonly tokenEndpoint: string = DEFAULT_TOKEN_ENDPOINT,
  ) {}

  async refresh(refreshToken: string): Promise<TokenResponse> {
    return postTokenRequest(this.tokenEndpoint, {
      grant_type: 'refresh_token',
      client_id: this.clientId,
      refresh_token: refreshToken,
    });
  }
}
