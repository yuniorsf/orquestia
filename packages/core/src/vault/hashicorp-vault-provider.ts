import type { Clock } from '../shared/clock.js';
import type { TokenGenerator } from '../shared/token-generator.js';
import {
  VaultHttpError,
  type AgentAccessAuditEntry,
  type IVaultAuthPort,
  type IVaultProvider,
  type Subscription,
} from './types.js';

interface VaultKvReadResponse<T> {
  readonly data: {
    readonly data: T;
  };
}

interface VaultListResponse {
  readonly data: {
    readonly keys: readonly string[];
  };
}

interface CredentialRecord {
  readonly value: string;
  readonly updatedAt: number;
}

/**
 * Enterprise vault backend over the HashiCorp Vault HTTP API (KV v2 mount,
 * conventionally `secret/data/developers`) with corporate audit/RBAC
 * enforced server-side by Vault itself. Implements the same
 * {@link IVaultProvider} port as `SQLCipherVaultProvider`, so the two are
 * interchangeable. Auth is delegated to an injected {@link IVaultAuthPort}.
 */
export class HashiCorpVaultProvider implements IVaultProvider {
  constructor(
    private readonly vaultAddr: string,
    private readonly auth: IVaultAuthPort,
    private readonly clock: Clock,
    private readonly tokenGenerator: TokenGenerator,
    private readonly mount: string = 'secret',
    private readonly prefix: string = 'developers',
  ) {}

  async getCredential(key: string): Promise<string | null> {
    const record = await this.readKv<CredentialRecord>(`credentials/${key}`);
    return record ? record.value : null;
  }

  async setCredential(key: string, value: string): Promise<void> {
    const record: CredentialRecord = { value, updatedAt: this.clock.now() };
    await this.writeKv(`credentials/${key}`, record);
  }

  async deleteCredential(key: string): Promise<void> {
    await this.deleteKv(`credentials/${key}`);
  }

  async listCredentialKeys(): Promise<readonly string[]> {
    return this.listKv('credentials');
  }

  async listSubscriptions(): Promise<readonly Subscription[]> {
    const ids = await this.listKv('subscriptions');
    const subscriptions = await Promise.all(
      ids.map((id) => this.readKv<Subscription>(`subscriptions/${id}`)),
    );
    return subscriptions
      .filter((subscription): subscription is Subscription => subscription !== null)
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  async upsertSubscription(subscription: Subscription): Promise<void> {
    await this.writeKv(`subscriptions/${subscription.id}`, subscription);
  }

  async recordAgentAccess(entry: Omit<AgentAccessAuditEntry, 'id'>): Promise<void> {
    const id = this.tokenGenerator.generate();
    const record: AgentAccessAuditEntry = { ...entry, id };
    await this.writeKv(`agent_access_audit/${entry.agentId}/${id}`, record);
  }

  async listAgentAccessAudit(agentId: string): Promise<readonly AgentAccessAuditEntry[]> {
    const ids = await this.listKv(`agent_access_audit/${agentId}`);
    const entries = await Promise.all(
      ids.map((id) => this.readKv<AgentAccessAuditEntry>(`agent_access_audit/${agentId}/${id}`)),
    );
    return entries
      .filter((entry): entry is AgentAccessAuditEntry => entry !== null)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  private async readKv<T>(path: string): Promise<T | null> {
    const response = await this.request('GET', `data/${this.prefix}/${path}`);
    if (response.status === 404) {
      return null;
    }
    await assertOk(response);
    const body = (await response.json()) as VaultKvReadResponse<T>;
    return body.data.data;
  }

  private async writeKv(path: string, value: unknown): Promise<void> {
    const response = await this.request('POST', `data/${this.prefix}/${path}`, { data: value });
    await assertOk(response);
  }

  private async deleteKv(path: string): Promise<void> {
    // Unlike GET/LIST, Vault's metadata DELETE is idempotent — it returns
    // 204 whether or not the path ever existed, never 404.
    const response = await this.request('DELETE', `metadata/${this.prefix}/${path}`);
    await assertOk(response);
  }

  private async listKv(path: string): Promise<readonly string[]> {
    const response = await this.request('LIST', `metadata/${this.prefix}/${path}`);
    if (response.status === 404) {
      return [];
    }
    await assertOk(response);
    const body = (await response.json()) as VaultListResponse;
    return body.data.keys;
  }

  private async request(method: string, path: string, body?: unknown): Promise<Response> {
    const token = await this.auth.getToken();
    return fetch(`${this.vaultAddr}/v1/${this.mount}/${path}`, {
      method,
      headers: {
        'X-Vault-Token': token,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }
}

async function assertOk(response: Response): Promise<void> {
  if (!response.ok) {
    throw new VaultHttpError(response.status, await response.text());
  }
}
