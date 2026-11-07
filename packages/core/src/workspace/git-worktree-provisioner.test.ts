import { execFile } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GitWorktreeProvisioner } from './git-worktree-provisioner.js';
import { WorktreeInitializationError } from './types.js';

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

  describe('INIT_CMD from .harness/harness.env', () => {
    async function writeHarnessEnv(contents: string): Promise<void> {
      await mkdir(join(repoRoot, '.harness'), { recursive: true });
      await writeFile(join(repoRoot, '.harness', 'harness.env'), contents, 'utf8');
    }

    it('runs INIT_CMD inside the newly-created worktree', async () => {
      await writeHarnessEnv('INIT_CMD="echo ran > init-marker.txt"\n');
      const provisioner = new GitWorktreeProvisioner(repoRoot, worktreesRoot);

      await provisioner.create('TASK-1', 'develop');

      expect(
        (await readFile(join(worktreesRoot, 'TASK-1', 'init-marker.txt'), 'utf8')).trim(),
      ).toBe('ran');
    });

    it('is a no-op, not a throw, when .harness/harness.env does not exist at all', async () => {
      const provisioner = new GitWorktreeProvisioner(repoRoot, worktreesRoot);

      await expect(provisioner.create('TASK-1', 'develop')).resolves.toMatchObject({
        taskId: 'TASK-1',
      });
    });

    it('is a no-op when harness.env exists but has no INIT_CMD key', async () => {
      await writeHarnessEnv('PROJECT_NAME="fixture"\n# a comment\n\nnot a valid assignment line\n');
      const provisioner = new GitWorktreeProvisioner(repoRoot, worktreesRoot);

      await expect(provisioner.create('TASK-1', 'develop')).resolves.toMatchObject({
        taskId: 'TASK-1',
      });
    });

    it('throws WorktreeInitializationError when INIT_CMD fails, naming the command and worktree path', async () => {
      await writeHarnessEnv('INIT_CMD="exit 1"\n');
      const provisioner = new GitWorktreeProvisioner(repoRoot, worktreesRoot);

      await expect(provisioner.create('TASK-1', 'develop')).rejects.toThrow(
        WorktreeInitializationError,
      );
    });
  });
});
