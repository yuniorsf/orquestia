import type { ConfluencePublisherPort } from '../planning/types.js';
import type { CredentialStorePort } from '../vault/types.js';
import { AlmHttpError } from './types.js';

interface ConfluenceSearchResult {
  readonly id: string;
  readonly version: { readonly number: number };
}

interface ConfluenceSearchResponse {
  readonly results: readonly ConfluenceSearchResult[];
}

const DEFAULT_BASE_URL = 'https://api.atlassian.com';
const ACCESS_TOKEN_CREDENTIAL_KEY = 'atlassian_access_token';

/**
 * Real `ConfluencePublisherPort` adapter over the Confluence Cloud REST
 * API v1 content endpoints (`/wiki/rest/api/content`), reached through
 * Atlassian's OAuth 2.0 (3LO) API gateway. `publishPage` is an upsert:
 * it searches the space for an existing page with the given title and
 * updates it (new version), or creates one if none exists.
 *
 * Markdown is wrapped in a `<pre>` block under the `storage` (XHTML)
 * representation rather than converted to rich Confluence markup —
 * every Confluence Cloud site accepts this with no plugin dependency,
 * and faithful markdown-to-storage-format rendering is a larger,
 * separate concern left for a future ticket.
 */
export class HttpConfluencePublisherPort implements ConfluencePublisherPort {
  constructor(
    private readonly cloudId: string,
    private readonly spaceKey: string,
    private readonly credentialStore: CredentialStorePort,
    private readonly baseUrl: string = DEFAULT_BASE_URL,
  ) {}

  async publishPage(title: string, markdown: string): Promise<void> {
    const token = await this.getAccessToken();
    const storageValue = toStorageFormat(markdown);
    const existing = await this.findExistingPage(title, token);

    const contentUrl = `${this.baseUrl}/ex/confluence/${this.cloudId}/wiki/rest/api/content`;
    const response = existing
      ? await fetch(`${contentUrl}/${existing.id}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: existing.id,
            type: 'page',
            title,
            version: { number: existing.version.number + 1 },
            body: { storage: { value: storageValue, representation: 'storage' } },
          }),
        })
      : await fetch(contentUrl, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'page',
            title,
            space: { key: this.spaceKey },
            body: { storage: { value: storageValue, representation: 'storage' } },
          }),
        });

    if (!response.ok) {
      throw new AlmHttpError(response.status, await response.text());
    }
  }

  private async findExistingPage(
    title: string,
    token: string,
  ): Promise<ConfluenceSearchResult | null> {
    const searchUrl = new URL(
      `${this.baseUrl}/ex/confluence/${this.cloudId}/wiki/rest/api/content`,
    );
    searchUrl.searchParams.set('spaceKey', this.spaceKey);
    searchUrl.searchParams.set('title', title);
    searchUrl.searchParams.set('expand', 'version');

    const response = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new AlmHttpError(response.status, await response.text());
    }
    const body = (await response.json()) as ConfluenceSearchResponse;
    return body.results[0] ?? null;
  }

  private async getAccessToken(): Promise<string> {
    const token = await this.credentialStore.getCredential(ACCESS_TOKEN_CREDENTIAL_KEY);
    if (!token) {
      throw new AlmHttpError(401, 'No Atlassian access token is stored in the vault.');
    }
    return token;
  }
}

function toStorageFormat(markdown: string): string {
  return `<pre>${escapeXhtml(markdown)}</pre>`;
}

function escapeXhtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
