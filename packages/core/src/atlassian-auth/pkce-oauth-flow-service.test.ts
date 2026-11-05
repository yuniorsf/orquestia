import { describe, expect, it } from 'vitest';
import { FakeRandomBytesPort } from '../vault/test-builders.js';
import { PkceOAuthFlowService } from './pkce-oauth-flow-service.js';
import { OAuthCallbackError, OAuthStateMismatchError, type TokenResponse } from './types.js';
import { FakeCallbackListenerPort, FakeTokenExchangePort } from './test-builders.js';

const config = { clientId: 'client-123', redirectUri: 'http://localhost:8085/callback' };
const tokens: TokenResponse = {
  accessToken: 'access-abc',
  refreshToken: 'refresh-abc',
  expiresInSeconds: 3600,
  scope: 'read:jira-work',
};

function capturedState(authorizeUrl: string): string {
  return new URL(authorizeUrl).searchParams.get('state')!;
}

describe('PkceOAuthFlowService.run', () => {
  it('builds the authorize URL, exchanges the matching callback for tokens, and stops the listener', async () => {
    let authorizeUrl = '';
    const tokenExchange = new FakeTokenExchangePort(tokens);
    const callbackListener = new FakeCallbackListenerPort(async () => ({
      code: 'auth-code-xyz',
      state: capturedState(authorizeUrl),
    }));
    const service = new PkceOAuthFlowService(
      callbackListener,
      tokenExchange,
      new FakeRandomBytesPort(),
    );

    const result = await service.run(config, (url) => {
      authorizeUrl = url;
    });

    expect(authorizeUrl).toContain('https://auth.atlassian.com/authorize');
    expect(result).toEqual(tokens);
    expect(tokenExchange.calls).toEqual([
      { code: 'auth-code-xyz', codeVerifier: expect.any(String), redirectUri: config.redirectUri },
    ]);
    expect(callbackListener.stopCalls).toBe(1);
  });

  it('passes custom scopes through to the authorize URL when given', async () => {
    let authorizeUrl = '';
    const callbackListener = new FakeCallbackListenerPort(async () => ({
      code: 'auth-code-xyz',
      state: capturedState(authorizeUrl),
    }));
    const service = new PkceOAuthFlowService(
      callbackListener,
      new FakeTokenExchangePort(tokens),
      new FakeRandomBytesPort(),
    );

    await service.run({ ...config, scopes: ['read:jira-work'] }, (url) => {
      authorizeUrl = url;
    });

    expect(new URL(authorizeUrl).searchParams.get('scope')).toBe('read:jira-work');
  });

  it('throws OAuthStateMismatchError when the callback state does not match, and still stops the listener', async () => {
    const callbackListener = new FakeCallbackListenerPort(async () => ({
      code: 'auth-code-xyz',
      state: 'a-completely-different-state',
    }));
    const service = new PkceOAuthFlowService(
      callbackListener,
      new FakeTokenExchangePort(tokens),
      new FakeRandomBytesPort(),
    );

    await expect(service.run(config, () => {})).rejects.toThrow(OAuthStateMismatchError);
    expect(callbackListener.stopCalls).toBe(1);
  });

  it('propagates a callback error (e.g. user denied consent) and still stops the listener', async () => {
    const callbackListener = new FakeCallbackListenerPort(async () => {
      throw new OAuthCallbackError('access_denied');
    });
    const service = new PkceOAuthFlowService(
      callbackListener,
      new FakeTokenExchangePort(tokens),
      new FakeRandomBytesPort(),
    );

    await expect(service.run(config, () => {})).rejects.toThrow(OAuthCallbackError);
    expect(callbackListener.stopCalls).toBe(1);
  });
});
