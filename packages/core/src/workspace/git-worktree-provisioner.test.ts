import { execFile } from 'node:child_process';
import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GitWorktreeProvisioner } from './git-worktree-provisioner.js';

const execFileAsync = promisify(execFile);

describe('GitWorktreeProvisioner', () => {
  let repoRoot: string;
  let worktreesRoot: string;

  beforeEach(async () => {
    repoRoot = await mkdtemp(join(tmpdir(), 'orquestia-repo-'));
    worktreesRoot = await mkdtemp(join(tmpdir(), 'orquestia-worktrees-'));

    await execFileAsync('git', ['init', '--initial-branch=develop'], { cwd: repoRoot });
    await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: repoRoot });
    await execFileAsync('git', ['config', 'user.name', 'Test'], { cwd: repoRoot });
    await writeFile(join(repoRoot, 'README.md'), '# fixture\n', 'utf8');
    await execFileAsync('git', ['add', 'README.md'], { cwd: repoRoot });
    await execFileAsync('git', ['commit', '-m', 'init'], { cwd: repoRoot });
  });

  afterEach(async () => {
    await rm(repoRoot, { recursive: true, force: true });
    await rm(worktreesRoot, { recursive: true, force: true });
  });

  it('creates a worktree on a new branch from the given base ref', async () => {
    const provisioner = new GitWorktreeProvisioner(repoRoot, worktreesRoot);

    const handle = await provisioner.create('TASK-1', 'develop');

    expect(handle).toEqual({
      taskId: 'TASK-1',
      path: join(worktreesRoot, 'TASK-1'),
      branch: 'task-1',
    });
    await expect(access(join(worktreesRoot, 'TASK-1', 'README.md'))).resolves.toBeUndefined();
  });

  it('removes the worktree directory on destroy', async () => {
    const provisioner = new GitWorktreeProvisioner(repoRoot, worktreesRoot);
    await provisioner.create('TASK-1', 'develop');

    await provisioner.destroy('TASK-1');

    await expect(access(join(worktreesRoot, 'TASK-1'))).rejects.toThrow();
  });
});
