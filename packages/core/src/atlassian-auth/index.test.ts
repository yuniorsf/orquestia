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
});
