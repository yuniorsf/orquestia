import { describe, expect, it } from 'vitest';
import { DEFAULT_SCOPES, buildAuthorizationUrl } from './authorization-url.js';

describe('buildAuthorizationUrl', () => {
  it('builds the authorize URL with PKCE and the default scopes', () => {
    const url = new URL(
      buildAuthorizationUrl({
        clientId: 'client-123',
        redirectUri: 'http://localhost:8085/callback',
        state: 'state-abc',
        codeChallenge: 'challenge-xyz',
      }),
    );

    expect(url.origin + url.pathname).toBe('https://auth.atlassian.com/authorize');
    expect(url.searchParams.get('audience')).toBe('api.atlassian.com');
    expect(url.searchParams.get('client_id')).toBe('client-123');
    expect(url.searchParams.get('scope')).toBe(DEFAULT_SCOPES.join(' '));
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:8085/callback');
    expect(url.searchParams.get('state')).toBe('state-abc');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('prompt')).toBe('consent');
    expect(url.searchParams.get('code_challenge')).toBe('challenge-xyz');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('uses the default scopes exactly as specified by the ticket', () => {
    expect(DEFAULT_SCOPES).toEqual([
      'read:jira-work',
      'write:jira-work',
      'read:confluence-space.summary',
      'write:confluence-content',
      'offline_access',
    ]);
  });

  it('uses custom scopes when given, instead of the defaults', () => {
    const url = new URL(
      buildAuthorizationUrl({
        clientId: 'client-123',
        redirectUri: 'http://localhost:8085/callback',
        state: 'state-abc',
        codeChallenge: 'challenge-xyz',
        scopes: ['read:jira-work'],
      }),
    );

    expect(url.searchParams.get('scope')).toBe('read:jira-work');
  });
});
