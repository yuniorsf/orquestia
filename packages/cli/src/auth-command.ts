import type { CredentialStorePort } from '@orquestia/core';
import type { CliCommand, CommandResult } from './types.js';

const USAGE = 'Usage: orquestia auth <store|get|rotate|list> ...\n';

/** Shows at most the first/last 2 characters; a secret must never land in a terminal/log in full unless explicitly revealed. */
function maskSecret(value: string): string {
  if (value.length <= 4) {
    return '*'.repeat(value.length);
  }
  return `${value.slice(0, 2)}${'*'.repeat(value.length - 4)}${value.slice(-2)}`;
}

/**
 * `orquestia auth <store|get|rotate|list>` — a thin CLI wrapper around
 * the already-real, already-tested `CredentialStorePort` (SQLCipher by
 * default — see `main.ts`; `HashiCorpVaultProvider` is a drop-in
 * alternative, both from ORQ-18/19). `get` masks the value by default
 * (`--reveal` opts into printing it in full) — a stored credential must
 * never land in a terminal/log in plaintext unless explicitly asked for.
 */
export class AuthCommand implements CliCommand {
  readonly name = 'auth';
  readonly summary = 'Manage encrypted vault credentials (store/get/rotate/list)';

  constructor(private readonly credentialStore: CredentialStorePort) {}

  async run(args: readonly string[]): Promise<CommandResult> {
    const [action, ...rest] = args;
    switch (action) {
      case 'store':
        return this.store(rest);
      case 'get':
        return this.get(rest);
      case 'rotate':
        return this.rotate(rest);
      case 'list':
        return this.list();
      default:
        return { exitCode: 1, stdout: '', stderr: USAGE };
    }
  }

  private async store(args: readonly string[]): Promise<CommandResult> {
    const [key, value] = args;
    if (!key || value === undefined) {
      return { exitCode: 1, stdout: '', stderr: 'Usage: orquestia auth store <key> <value>\n' };
    }
    await this.credentialStore.setCredential(key, value);
    return { exitCode: 0, stdout: `Stored credential "${key}".\n`, stderr: '' };
  }

  private async get(args: readonly string[]): Promise<CommandResult> {
    const key = args[0];
    const reveal = args.includes('--reveal');
    if (!key) {
      return { exitCode: 1, stdout: '', stderr: 'Usage: orquestia auth get <key> [--reveal]\n' };
    }

    const value = await this.credentialStore.getCredential(key);
    if (value === null) {
      return { exitCode: 1, stdout: '', stderr: `No credential stored for "${key}".\n` };
    }
    return { exitCode: 0, stdout: `${reveal ? value : maskSecret(value)}\n`, stderr: '' };
  }

  private async rotate(args: readonly string[]): Promise<CommandResult> {
    const [key, value] = args;
    if (!key || value === undefined) {
      return { exitCode: 1, stdout: '', stderr: 'Usage: orquestia auth rotate <key> <newValue>\n' };
    }

    const existing = await this.credentialStore.getCredential(key);
    if (existing === null) {
      return {
        exitCode: 1,
        stdout: '',
        stderr: `Cannot rotate "${key}": no credential is currently stored for it. Use "store" to create one.\n`,
      };
    }

    await this.credentialStore.setCredential(key, value);
    return { exitCode: 0, stdout: `Rotated credential "${key}".\n`, stderr: '' };
  }

  private async list(): Promise<CommandResult> {
    const keys = await this.credentialStore.listCredentialKeys();
    if (keys.length === 0) {
      return { exitCode: 0, stdout: 'No credentials stored.\n', stderr: '' };
    }
    return { exitCode: 0, stdout: `${keys.join('\n')}\n`, stderr: '' };
  }
}
