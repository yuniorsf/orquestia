import type { CredentialStorePort } from '../vault/types.js';
import { AlmHttpError } from './types.js';
import type { BoardIssue, IssueBoardPort } from './types.js';

interface JiraSearchIssue {
  readonly key: string;
  readonly fields: {
    readonly summary: string;
    readonly status: { readonly name: string };
  };
}

interface JiraSearchResponse {
  readonly issues: readonly JiraSearchIssue[];
}

const DEFAULT_BASE_URL = 'https://api.atlassian.com';
const ACCESS_TOKEN_CREDENTIAL_KEY = 'atlassian_access_token';

/**
 * Real `IssueBoardPort` adapter over the Jira Cloud REST API v3's JQL
 * search endpoint, reached through Atlassian's OAuth 2.0 (3LO) API gateway
 * — feeds the Kanban board view with every issue in a project, grouped
 * client-side by {@link groupIssuesIntoBoard}.
 */
export class HttpIssueBoardPort implements IssueBoardPort {
  constructor(
    private readonly cloudId: string,
    private readonly credentialStore: CredentialStorePort,
    private readonly baseUrl: string = DEFAULT_BASE_URL,
  ) {}

  async listIssues(projectKey: string): Promise<readonly BoardIssue[]> {
    const token = await this.credentialStore.getCredential(ACCESS_TOKEN_CREDENTIAL_KEY);
    if (!token) {
      throw new AlmHttpError(401, 'No Atlassian access token is stored in the vault.');
    }

    const jql = encodeURIComponent(`project = ${projectKey} ORDER BY status ASC`);
    const url = `${this.baseUrl}/ex/jira/${this.cloudId}/rest/api/3/search?jql=${jql}&fields=summary,status`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new AlmHttpError(response.status, await response.text());
    }

    const { issues } = (await response.json()) as JiraSearchResponse;
    return issues.map((issue) => ({
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status.name,
    }));
  }
}
