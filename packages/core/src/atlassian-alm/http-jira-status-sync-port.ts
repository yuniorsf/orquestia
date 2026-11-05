import type { JiraStatusSyncPort } from '../planning/types.js';
import type { CredentialStorePort } from '../vault/types.js';
import { AlmHttpError, UnknownJiraTransitionError } from './types.js';

interface JiraTransition {
  readonly id: string;
  readonly to: { readonly name: string };
}

interface JiraTransitionsResponse {
  readonly transitions: readonly JiraTransition[];
}

const DEFAULT_BASE_URL = 'https://api.atlassian.com';
const ACCESS_TOKEN_CREDENTIAL_KEY = 'atlassian_access_token';

/**
 * Real `JiraStatusSyncPort` adapter over the Jira Cloud REST API v3,
 * reached through Atlassian's OAuth 2.0 (3LO) API gateway
 * (`api.atlassian.com/ex/jira/{cloudId}/...`). The access token is read
 * fresh from the vault on every call rather than cached here, so a
 * background-rotated token is always picked up.
 */
export class HttpJiraStatusSyncPort implements JiraStatusSyncPort {
  constructor(
    private readonly cloudId: string,
    private readonly credentialStore: CredentialStorePort,
    private readonly baseUrl: string = DEFAULT_BASE_URL,
  ) {}

  async transitionIssue(issueKey: string, statusName: string): Promise<void> {
    const token = await this.getAccessToken();
    const transitionsUrl = `${this.baseUrl}/ex/jira/${this.cloudId}/rest/api/3/issue/${issueKey}/transitions`;

    const listResponse = await fetch(transitionsUrl, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!listResponse.ok) {
      throw new AlmHttpError(listResponse.status, await listResponse.text());
    }
    const { transitions } = (await listResponse.json()) as JiraTransitionsResponse;
    const match = transitions.find((transition) => transition.to.name === statusName);
    if (!match) {
      throw new UnknownJiraTransitionError(issueKey, statusName);
    }

    const applyResponse = await fetch(transitionsUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ transition: { id: match.id } }),
    });
    if (!applyResponse.ok) {
      throw new AlmHttpError(applyResponse.status, await applyResponse.text());
    }
  }

  private async getAccessToken(): Promise<string> {
    const token = await this.credentialStore.getCredential(ACCESS_TOKEN_CREDENTIAL_KEY);
    if (!token) {
      throw new AlmHttpError(401, 'No Atlassian access token is stored in the vault.');
    }
    return token;
  }
}
