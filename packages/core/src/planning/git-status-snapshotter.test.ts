import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GitStatusSnapshotter } from './git-status-snapshotter.js';

const execFileAsync = promisify(execFile);

describe('GitStatusSnapshotter', () => {
  let repoRoot: string;

  beforeEach(async () => {
    repoRoot = await mkdtemp(join(tmpdir(), 'orquestia-baseline-'));
    await execFileAsync('git', ['init', '--initial-branch=develop'], { cwd: repoRoot });
    await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: repoRoot });
    await execFileAsync('git', ['config', 'user.name', 'Test'], { cwd: repoRoot });
    await writeFile(join(repoRoot, 'README.md'), '# fixture\n', 'utf8');
    await execFileAsync('git', ['add', 'README.md'], { cwd: repoRoot });
    await execFileAsync('git', ['commit', '-m', 'init'], { cwd: repoRoot });
  });

  afterEach(async () => {
    await rm(repoRoot, { recursive: true, force: true });
  });

  it('reports a clean baseline on a pristine checkout', async () => {
    const snapshotter = new GitStatusSnapshotter(repoRoot);

    const baseline = await snapshotter.captureBaseline();

    expect(baseline.isClean).toBe(true);
    expect(baseline.porcelain).toBe('');
    expect(baseline.headSha).toMatch(/^[0-9a-f]{4,40}$/);
  });

  it('reports a dirty baseline when the worktree has uncommitted changes', async () => {
    await writeFile(join(repoRoot, 'README.md'), '# fixture (changed)\n', 'utf8');
    const snapshotter = new GitStatusSnapshotter(repoRoot);

    const baseline = await snapshotter.captureBaseline();

    expect(baseline.isClean).toBe(false);
    expect(baseline.porcelain).toContain('README.md');
  });
});
