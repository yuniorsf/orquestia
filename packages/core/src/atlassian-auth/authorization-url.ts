const AUTHORIZE_BASE_URL = 'https://auth.atlassian.com/authorize';

export const DEFAULT_SCOPES: readonly string[] = [
  'read:jira-work',
  'write:jira-work',
  'read:confluence-space.summary',
  'write:confluence-content',
  'offline_access',
];

export interface BuildAuthorizationUrlInput {
  readonly clientId: string;
  readonly redirectUri: string;
  readonly state: string;
  readonly codeChallenge: string;
  readonly scopes?: readonly string[];
}

/** Pure URL builder — no network call, fully deterministic given its inputs. */
export function buildAuthorizationUrl(input: BuildAuthorizationUrlInput): string {
  const url = new URL(AUTHORIZE_BASE_URL);
  url.searchParams.set('audience', 'api.atlassian.com');
  url.searchParams.set('client_id', input.clientId);
  url.searchParams.set('scope', (input.scopes ?? DEFAULT_SCOPES).join(' '));
  url.searchParams.set('redirect_uri', input.redirectUri);
  url.searchParams.set('state', input.state);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('code_challenge', input.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}
