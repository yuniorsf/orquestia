import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const verifier = join(process.cwd(), 'scripts', 'verify-agent-worktree.sh');
let scratchDir: string;
let targetDir: string;

beforeEach(async () => {
  scratchDir = await mkdtemp(join(tmpdir(), 'orquestia-oracle-'));
  targetDir = join(scratchDir, 'nested', 'worktree with spaces');
  await mkdir(join(targetDir, '.harness'), { recursive: true });
  await mkdir(join(targetDir, 'scripts'));
  await writeFile(
    join(targetDir, '.harness', 'harness.env'),
    'FORMAT_CHECK_CMD="true"\nBUILD_AND_LINT_CMD="true"\nARCH_TEST_CMD="true"\n',
  );
  // The target-local verifier checks the directory it receives, without running another build.
  await writeFile(
    join(targetDir, 'scripts', 'verify-solid-contracts.py'),
    'import pathlib, sys\n' +
      'target = pathlib.Path(sys.argv[2])\n' +
      'assert target.is_absolute() and target.resolve() == pathlib.Path.cwd(), str(target)\n' +
      'print("target-local SOLID verifier ran")\n',
  );
});

afterEach(async () => {
  await rm(scratchDir, { recursive: true, force: true });
});

describe('scripts/verify-agent-worktree.sh', () => {
  for (const kind of ['relative', 'absolute', 'default'] as const) {
    it(`passes the resolved worktree to Stage 3 for a ${kind} target`, () => {
      const args =
        kind === 'default' ? [] : [kind === 'absolute' ? targetDir : 'nested/worktree with spaces'];
      const result = spawnSync('bash', [verifier, ...args], {
        cwd: kind === 'default' ? targetDir : scratchDir,
        encoding: 'utf8',
      });
      expect(result.status, result.stdout + result.stderr).toBe(0);
      expect(result.stdout).toContain('target-local SOLID verifier ran');
      expect(result.stdout).toContain('[ORACLE:VERIFIED]');
    });
  }

  it('rejects a missing target before running any stage', () => {
    const result = spawnSync('bash', [verifier, 'missing'], {
      cwd: scratchDir,
      encoding: 'utf8',
    });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('Target worktree directory does not exist');
    expect(result.stdout).not.toContain('Stage 1');
  });
});
