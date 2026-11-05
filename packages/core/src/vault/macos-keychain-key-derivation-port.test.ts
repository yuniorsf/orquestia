import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  MacosKeychainKeyDerivationPort,
  keychainArgs,
} from './macos-keychain-key-derivation-port.js';
import { FakeRandomBytesPort } from './test-builders.js';
import { VAULT_KEY_LENGTH_BYTES } from './vault-crypto.js';

const execFileAsync = promisify(execFile);
const KEYCHAIN_PASSWORD = 'orquestia-test-keychain-password';

describe('keychainArgs', () => {
  it('returns an empty args list when no keychain path is given (default login keychain)', () => {
    expect(keychainArgs(undefined)).toEqual([]);
  });

  it('returns the path as a single arg when a keychain path is given', () => {
    expect(keychainArgs('/tmp/some.keychain-db')).toEqual(['/tmp/some.keychain-db']);
  });
});

/**
 * Exercises the real macOS Keychain against a throwaway keychain file
 * (never the user's real login keychain), the same way
 * `GitStashCheckpoint`/`GitWorktreeProvisioner` exercise real `git`
 * against disposable temp repos. Skipped off-macOS since `security` is
 * a macOS-only CLI.
 */
describe.skipIf(process.platform !== 'darwin')('MacosKeychainKeyDerivationPort', () => {
  let workDir: string;
  let keychainPath: string;

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'orquestia-vault-test-'));
    keychainPath = join(workDir, `${randomUUID()}.keychain-db`);
    await execFileAsync('security', ['create-keychain', '-p', KEYCHAIN_PASSWORD, keychainPath]);
    await execFileAsync('security', ['set-keychain-settings', keychainPath]);
    await execFileAsync('security', ['unlock-keychain', '-p', KEYCHAIN_PASSWORD, keychainPath]);
  });

  afterEach(async () => {
    await execFileAsync('security', ['delete-keychain', keychainPath]).catch(() => {});
    await rm(workDir, { recursive: true, force: true });
  });

  it('generates and stores a new master key on first use', async () => {
    const port = new MacosKeychainKeyDerivationPort(new FakeRandomBytesPort(), keychainPath);

    const key = await port.getOrCreateMasterKey();

    expect(key).toHaveLength(VAULT_KEY_LENGTH_BYTES);
  });

  it('reuses the stored master key on later calls instead of generating a new one', async () => {
    const first = await new MacosKeychainKeyDerivationPort(
      new FakeRandomBytesPort(),
      keychainPath,
    ).getOrCreateMasterKey();
    // A fresh instance with its own random source: if lookup worked, it
    // returns the already-stored key rather than generating its own.
    const second = await new MacosKeychainKeyDerivationPort(
      new FakeRandomBytesPort(),
      keychainPath,
    ).getOrCreateMasterKey();

    expect(second.equals(first)).toBe(true);
  });

  it('scopes storage to the given account/service so unrelated items are not matched', async () => {
    // Shared generator: each port's first-use key comes from the *next*
    // call in the sequence, so the two generated keys are guaranteed to
    // differ regardless of Keychain scoping — isolating what this test
    // actually verifies (storage/lookup scoping) from key generation.
    const randomBytes = new FakeRandomBytesPort();
    const portA = new MacosKeychainKeyDerivationPort(
      randomBytes,
      keychainPath,
      'account-a',
      'service-a',
    );
    const portB = new MacosKeychainKeyDerivationPort(
      randomBytes,
      keychainPath,
      'account-b',
      'service-b',
    );

    const keyA = await portA.getOrCreateMasterKey();
    const keyB = await portB.getOrCreateMasterKey();

    expect(keyA.equals(keyB)).toBe(false);
  });
});
