import type {
  CallbackListenerPort,
  OAuthCallbackResult,
  StoredToken,
  TokenExchangePort,
  TokenRefreshPort,
  TokenResponse,
  TokenStorePort,
} from './types.js';

export class FakeCallbackListenerPort implements CallbackListenerPort {
  stopCalls = 0;

  constructor(private readonly resolveWith: () => Promise<OAuthCallbackResult>) {}

  async awaitCallback(): Promise<OAuthCallbackResult> {
    return this.resolveWith();
  }

  async stop(): Promise<void> {
    this.stopCalls += 1;
  }
}

export class FakeTokenExchangePort implements TokenExchangePort {
  readonly calls: Array<{ code: string; codeVerifier: string; redirectUri: string }> = [];

  constructor(private readonly response: TokenResponse) {}

  async exchangeCodeForTokens(
    code: string,
    codeVerifier: string,
    redirectUri: string,
  ): Promise<TokenResponse> {
    this.calls.push({ code, codeVerifier, redirectUri });
    return this.response;
  }
}

export class FakeTokenStorePort implements TokenStorePort {
  readonly savedTokens: StoredToken[] = [];

  constructor(private stored: StoredToken | null = null) {}

  async getStoredToken(): Promise<StoredToken | null> {
    return this.stored;
  }

  async saveToken(token: StoredToken): Promise<void> {
    this.stored = token;
    this.savedTokens.push(token);
  }
}

export class FakeTokenRefreshPort implements TokenRefreshPort {
  readonly calls: string[] = [];

  constructor(private readonly response: TokenResponse) {}

  async refresh(refreshToken: string): Promise<TokenResponse> {
    this.calls.push(refreshToken);
    return this.response;
  }
}
