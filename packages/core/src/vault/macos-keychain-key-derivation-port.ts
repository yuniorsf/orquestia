import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { VAULT_KEY_LENGTH_BYTES } from './vault-crypto.js';
import type { IKeyDerivationPort, RandomBytesPort } from './types.js';

const execFileAsync = promisify(execFile);

const DEFAULT_ACCOUNT = 'orquestia-vault';
const DEFAULT_SERVICE = 'orquestia-vault-master-key';

/**
 * Pure helper so the "use the default login keychain" branch (no path
 * given) is unit-testable without ever touching a real keychain — only
 * the path-given branch is exercised against a real, disposable
 * keychain in integration tests.
 */
export function keychainArgs(keychainPath?: string): readonly string[] {
  return keychainPath ? [keychainPath] : [];
}

/**
 * Derives (and persists) the vault's AES-256 master key via the macOS
 * Keychain, generating one on first use via the injected
 * {@link RandomBytesPort}. The key is stored hex-encoded in a generic
 * password item so later launches reuse the same key — silently
 * rotating it would make every previously encrypted field
 * undecryptable.
 */
export class MacosKeychainKeyDerivationPort implements IKeyDerivationPort {
  constructor(
    private readonly randomBytes: RandomBytesPort,
    private readonly keychainPath?: string,
    private readonly account: string = DEFAULT_ACCOUNT,
    private readonly service: string = DEFAULT_SERVICE,
  ) {}

  async getOrCreateMasterKey(): Promise<Buffer> {
    const existing = await this.findExisting();
    if (existing) {
      return existing;
    }

    const key = this.randomBytes.generate(VAULT_KEY_LENGTH_BYTES);
    await this.store(key);
    return key;
  }

  private async findExisting(): Promise<Buffer | null> {
    try {
      const { stdout } = await execFileAsync('security', [
        'find-generic-password',
        '-a',
        this.account,
        '-s',
        this.service,
        '-w',
        ...keychainArgs(this.keychainPath),
      ]);
      return Buffer.from(stdout.trim(), 'hex');
    } catch {
      return null;
    }
  }

  private async store(key: Buffer): Promise<void> {
    await execFileAsync('security', [
      'add-generic-password',
      '-a',
      this.account,
      '-s',
      this.service,
      '-w',
      key.toString('hex'),
      ...keychainArgs(this.keychainPath),
    ]);
  }
}
