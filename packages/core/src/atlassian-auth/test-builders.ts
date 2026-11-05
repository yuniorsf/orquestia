import type {
  CallbackListenerPort,
  OAuthCallbackResult,
  TokenExchangePort,
  TokenResponse,
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
