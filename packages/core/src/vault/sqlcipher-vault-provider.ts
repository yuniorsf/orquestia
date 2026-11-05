import type { DatabaseSync } from 'node:sqlite';
import type { Clock } from '../shared/clock.js';
import type { TokenGenerator } from '../shared/token-generator.js';
import { VAULT_IV_LENGTH_BYTES, decryptField, encryptField } from './vault-crypto.js';
import type {
  AgentAccessAuditEntry,
  IKeyDerivationPort,
  IVaultProvider,
  RandomBytesPort,
  Subscription,
} from './types.js';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS credentials (
    key TEXT PRIMARY KEY,
    iv BLOB NOT NULL,
    ciphertext BLOB NOT NULL,
    auth_tag BLOB NOT NULL,
    updated_at INTEGER NOT NULL
  ) STRICT;

  CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    plan_name TEXT NOT NULL,
    status TEXT NOT NULL,
    renews_at INTEGER
  ) STRICT;

  CREATE TABLE IF NOT EXISTS agent_access_audit (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    resource TEXT NOT NULL,
    action TEXT NOT NULL,
    timestamp INTEGER NOT NULL
  ) STRICT;
`;

interface CredentialRow {
  iv: Uint8Array;
  ciphertext: Uint8Array;
  auth_tag: Uint8Array;
}

interface SubscriptionRow {
  id: string;
  plan_name: string;
  status: string;
  renews_at: number | null;
}

interface AuditRow {
  id: string;
  agent_id: string;
  resource: string;
  action: string;
  timestamp: number;
}

/**
 * Security Vault Layer: local embedded vault backed by a SQLite file
 * (conventionally `~/.orquestia/vault.db`). Credential values are
 * encrypted field-by-field via AES-256-GCM; the master key comes from
 * the injected {@link IKeyDerivationPort} (OS keyring) and is never
 * hardcoded or stored in plaintext.
 */
export class SQLCipherVaultProvider implements IVaultProvider {
  private db: DatabaseSync | null = null;
  private masterKey: Buffer | null = null;

  constructor(
    private readonly dbPath: string,
    private readonly keyDerivation: IKeyDerivationPort,
    private readonly randomBytes: RandomBytesPort,
    private readonly clock: Clock,
    private readonly tokenGenerator: TokenGenerator,
  ) {}

  /**
   * `node:sqlite` is obtained via `process.getBuiltinModule` (a plain
   * runtime call) rather than an `import`/`import()` statement, since
   * bundler-based test runners that don't yet recognize this newer Node
   * builtin in their static import analysis (e.g. Vite 5.x) otherwise
   * try — and fail — to resolve it as a regular package.
   */
  private getDb(): DatabaseSync {
    if (!this.db) {
      const { DatabaseSync } = process.getBuiltinModule('node:sqlite');
      this.db = new DatabaseSync(this.dbPath);
      this.db.exec(SCHEMA);
    }
    return this.db;
  }

  async getCredential(key: string): Promise<string | null> {
    const db = this.getDb();
    const row = db
      .prepare('SELECT iv, ciphertext, auth_tag FROM credentials WHERE key = ?')
      .get(key) as unknown as CredentialRow | undefined;
    if (!row) {
      return null;
    }

    const masterKey = await this.getMasterKey();
    return decryptField(
      {
        iv: Buffer.from(row.iv),
        ciphertext: Buffer.from(row.ciphertext),
        authTag: Buffer.from(row.auth_tag),
      },
      masterKey,
    );
  }

  async setCredential(key: string, value: string): Promise<void> {
    const db = this.getDb();
    const masterKey = await this.getMasterKey();
    const iv = this.randomBytes.generate(VAULT_IV_LENGTH_BYTES);
    const encrypted = encryptField(value, masterKey, iv);

    db.prepare(
      `INSERT INTO credentials (key, iv, ciphertext, auth_tag, updated_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET
           iv = excluded.iv, ciphertext = excluded.ciphertext, auth_tag = excluded.auth_tag, updated_at = excluded.updated_at`,
    ).run(key, encrypted.iv, encrypted.ciphertext, encrypted.authTag, this.clock.now());
  }

  async deleteCredential(key: string): Promise<void> {
    const db = this.getDb();
    db.prepare('DELETE FROM credentials WHERE key = ?').run(key);
  }

  async listSubscriptions(): Promise<readonly Subscription[]> {
    const db = this.getDb();
    const rows = db
      .prepare('SELECT id, plan_name, status, renews_at FROM subscriptions ORDER BY id')
      .all() as unknown as SubscriptionRow[];
    return rows.map((row) => ({
      id: row.id,
      planName: row.plan_name,
      status: row.status,
      renewsAt: row.renews_at,
    }));
  }

  async upsertSubscription(subscription: Subscription): Promise<void> {
    const db = this.getDb();
    db.prepare(
      `INSERT INTO subscriptions (id, plan_name, status, renews_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           plan_name = excluded.plan_name, status = excluded.status, renews_at = excluded.renews_at`,
    ).run(subscription.id, subscription.planName, subscription.status, subscription.renewsAt);
  }

  async recordAgentAccess(entry: Omit<AgentAccessAuditEntry, 'id'>): Promise<void> {
    const db = this.getDb();
    const id = this.tokenGenerator.generate();
    db.prepare(
      'INSERT INTO agent_access_audit (id, agent_id, resource, action, timestamp) VALUES (?, ?, ?, ?, ?)',
    ).run(id, entry.agentId, entry.resource, entry.action, entry.timestamp);
  }

  async listAgentAccessAudit(agentId: string): Promise<readonly AgentAccessAuditEntry[]> {
    const db = this.getDb();
    const rows = db
      .prepare(
        'SELECT id, agent_id, resource, action, timestamp FROM agent_access_audit WHERE agent_id = ? ORDER BY timestamp',
      )
      .all(agentId) as unknown as AuditRow[];
    return rows.map((row) => ({
      id: row.id,
      agentId: row.agent_id,
      resource: row.resource,
      action: row.action,
      timestamp: row.timestamp,
    }));
  }

  close(): void {
    this.db?.close();
  }

  private async getMasterKey(): Promise<Buffer> {
    if (!this.masterKey) {
      this.masterKey = await this.keyDerivation.getOrCreateMasterKey();
    }
    return this.masterKey;
  }
}
