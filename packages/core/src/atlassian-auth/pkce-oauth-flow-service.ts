import type { RandomBytesPort } from '../vault/types.js';
import { buildAuthorizationUrl } from './authorization-url.js';
import {
  CODE_VERIFIER_BYTE_LENGTH,
  STATE_BYTE_LENGTH,
  deriveCodeChallenge,
  generateCodeVerifier,
  generateState,
} from './pkce.js';
import {
  OAuthStateMismatchError,
  type CallbackListenerPort,
  type TokenExchangePort,
  type TokenResponse,
} from './types.js';

export interface PkceOAuthFlowConfig {
  readonly clientId: string;
  readonly redirectUri: string;
  readonly scopes?: readonly string[];
}

/**
 * Orchestrates the full Atlassian OAuth 2.0 (3LO) + PKCE loopback flow:
 * generates the PKCE pair and CSRF `state`, builds the authorization URL
 * (handed back via `onAuthorizeUrlReady` so the caller can open a browser
 * while this awaits the redirect), waits for the callback, verifies
 * `state`, and exchanges the code for tokens. The listener is always
 * stopped afterward, whether the flow succeeded or failed.
 */
export class PkceOAuthFlowService {
  constructor(
    private readonly callbackListener: CallbackListenerPort,
    private readonly tokenExchange: TokenExchangePort,
    private readonly randomBytes: RandomBytesPort,
  ) {}

  async run(
    config: PkceOAuthFlowConfig,
    onAuthorizeUrlReady: (authorizeUrl: string) => void,
  ): Promise<TokenResponse> {
    const codeVerifier = generateCodeVerifier(this.randomBytes.generate(CODE_VERIFIER_BYTE_LENGTH));
    const codeChallenge = deriveCodeChallenge(codeVerifier);
    const state = generateState(this.randomBytes.generate(STATE_BYTE_LENGTH));

    const authorizeUrl = buildAuthorizationUrl({
      clientId: config.clientId,
      redirectUri: config.redirectUri,
      state,
      codeChallenge,
      ...(config.scopes ? { scopes: config.scopes } : {}),
    });
    onAuthorizeUrlReady(authorizeUrl);

    try {
      const callback = await this.callbackListener.awaitCallback();
      if (callback.state !== state) {
        throw new OAuthStateMismatchError();
      }
      return await this.tokenExchange.exchangeCodeForTokens(
        callback.code,
        codeVerifier,
        config.redirectUri,
      );
    } finally {
      await this.callbackListener.stop();
    }
  }
}
