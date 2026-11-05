import { describe, expect, it } from 'vitest';
import * as atlassianAuth from './index.js';

describe('atlassian-auth public API', () => {
  it('exports the PKCE primitives', () => {
    expect(atlassianAuth.generateCodeVerifier).toBeTypeOf('function');
    expect(atlassianAuth.deriveCodeChallenge).toBeTypeOf('function');
    expect(atlassianAuth.generateState).toBeTypeOf('function');
    expect(atlassianAuth.CODE_VERIFIER_BYTE_LENGTH).toBe(32);
    expect(atlassianAuth.STATE_BYTE_LENGTH).toBe(16);
  });

  it('exports the authorization URL builder and default scopes', () => {
    expect(atlassianAuth.buildAuthorizationUrl).toBeTypeOf('function');
    expect(atlassianAuth.DEFAULT_SCOPES).toHaveLength(5);
  });

  it('exports the domain error types', () => {
    expect(atlassianAuth.OAuthStateMismatchError).toBeTypeOf('function');
    expect(atlassianAuth.OAuthCallbackError).toBeTypeOf('function');
    expect(atlassianAuth.TokenExchangeError).toBeTypeOf('function');
  });

  it('exports the real adapters and orchestrating service', () => {
    expect(atlassianAuth.HttpCallbackListenerPort).toBeTypeOf('function');
    expect(atlassianAuth.HttpTokenExchangePort).toBeTypeOf('function');
    expect(atlassianAuth.PkceOAuthFlowService).toBeTypeOf('function');
  });

  it('exports the background token rotator and its adapters', () => {
    expect(atlassianAuth.HttpTokenRefreshPort).toBeTypeOf('function');
    expect(atlassianAuth.VaultTokenStorePort).toBeTypeOf('function');
    expect(atlassianAuth.BackgroundTokenRotatorService).toBeTypeOf('function');
    expect(atlassianAuth.REFRESH_LEAD_TIME_MS).toBe(5 * 60 * 1000);
    expect(atlassianAuth.IntervalTokenRotationScheduler).toBeTypeOf('function');
  });
});
