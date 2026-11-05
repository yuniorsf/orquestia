/**
 * Security Vault Layer (`IVaultProvider`): a local embedded secrets store
 * covering the `subscriptions`, `credentials`, and `agent_access_audit`
 * schema. `SQLCipherVaultProvider` is the first concrete adapter; other
 * backends (e.g. HashiCorp Vault) implement the same port in later tickets.
 */
export interface Credential {
  readonly key: string;
  readonly value: string;
  readonly updatedAt: number;
}

export interface Subscription {
  readonly id: string;
  readonly planName: string;
  readonly status: string;
  readonly renewsAt: number | null;
}

export interface AgentAccessAuditEntry {
  readonly id: string;
  readonly agentId: string;
  readonly resource: string;
  readonly action: string;
  readonly timestamp: number;
}

export interface CredentialStorePort {
  getCredential(key: string): Promise<string | null>;
  setCredential(key: string, value: string): Promise<void>;
  deleteCredential(key: string): Promise<void>;
}

export interface SubscriptionStorePort {
  listSubscriptions(): Promise<readonly Subscription[]>;
  upsertSubscription(subscription: Subscription): Promise<void>;
}

export interface AgentAccessAuditPort {
  recordAgentAccess(entry: Omit<AgentAccessAuditEntry, 'id'>): Promise<void>;
  listAgentAccessAudit(agentId: string): Promise<readonly AgentAccessAuditEntry[]>;
}

/** Combined role for adapters implementing the full vault surface; callers should depend on the narrower role ports above instead. */
export interface IVaultProvider
  extends CredentialStorePort, SubscriptionStorePort, AgentAccessAuditPort {}

/** Cryptographically secure randomness, injected so IV/key generation is testable. */
export interface RandomBytesPort {
  generate(length: number): Buffer;
}

/** Abstracts OS keyring access for the vault's AES-256 master key. */
export interface IKeyDerivationPort {
  getOrCreateMasterKey(): Promise<Buffer>;
}

export class VaultDecryptionError extends Error {
  constructor(
    message = 'Failed to decrypt vault field: authentication tag mismatch (tampered ciphertext or wrong master key).',
  ) {
    super(message);
    this.name = 'VaultDecryptionError';
  }
}
