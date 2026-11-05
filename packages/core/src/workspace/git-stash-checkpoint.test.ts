import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GitStashCheckpoint } from './git-stash-checkpoint.js';

const execFileAsync = promisify(execFile);

describe('GitStashCheckpoint', () => {
  let repoRoot: string;
  const filePath = () => join(repoRoot, 'tracked.txt');

  beforeEach(async () => {
    repoRoot = await mkdtemp(join(tmpdir(), 'orquestia-checkpoint-'));
    await execFileAsync('git', ['init', '--initial-branch=develop'], { cwd: repoRoot });
    await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: repoRoot });
    await execFileAsync('git', ['config', 'user.name', 'Test'], { cwd: repoRoot });
    await writeFile(filePath(), 'original\n', 'utf8');
    await execFileAsync('git', ['add', 'tracked.txt'], { cwd: repoRoot });
    await execFileAsync('git', ['commit', '-m', 'init'], { cwd: repoRoot });
  });

  afterEach(async () => {
    await rm(repoRoot, { recursive: true, force: true });
  });

  it('creates a checkpoint without disturbing the working tree', async () => {
    const checkpoint = new GitStashCheckpoint(repoRoot);
    await writeFile(filePath(), 'edited\n', 'utf8');

    const handle = await checkpoint.create();

    expect(handle.id).not.toBe('');
    await expect(readFile(filePath(), 'utf8')).resolves.toBe('edited\n');
  });

  it('rolls back to the checkpoint, discarding edits made after it', async () => {
    const checkpoint = new GitStashCheckpoint(repoRoot);
    await writeFile(filePath(), 'before remediation\n', 'utf8');
    const handle = await checkpoint.create();
    await writeFile(filePath(), 'non-convergent remediation\n', 'utf8');

    await checkpoint.rollback(handle);

    await expect(readFile(filePath(), 'utf8')).resolves.toBe('before remediation\n');
  });

  it('treats rollback of an empty handle (clean tree at checkpoint time) as a no-op', async () => {
    const checkpoint = new GitStashCheckpoint(repoRoot);
    const handle = await checkpoint.create(); // nothing to stash on a clean tree

    expect(handle.id).toBe('');
    await expect(checkpoint.rollback(handle)).resolves.toBeUndefined();
    await expect(readFile(filePath(), 'utf8')).resolves.toBe('original\n');
  });
});
