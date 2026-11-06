import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NodeProcessRunner } from './node-process-runner.js';

describe('NodeProcessRunner', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'orquestia-sea-runner-'));
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it('captures stdout/stderr and exit code 0 on success', async () => {
    const runner = new NodeProcessRunner();

    const result = await runner.run(
      process.execPath,
      ['-e', 'process.stdout.write("out"); process.stderr.write("err")'],
      cwd,
    );

    expect(result).toEqual({ exitCode: 0, stdout: 'out', stderr: 'err' });
  });

  it('reports a non-zero exit code and captured output on failure', async () => {
    const runner = new NodeProcessRunner();

    const result = await runner.run(
      process.execPath,
      ['-e', 'process.stdout.write("partial"); process.stderr.write("boom"); process.exit(5)'],
      cwd,
    );

    expect(result).toEqual({ exitCode: 5, stdout: 'partial', stderr: 'boom' });
  });

  it('falls back to exit code 1 with empty output when the command cannot be spawned', async () => {
    const runner = new NodeProcessRunner();

    const result = await runner.run(join(cwd, 'does-not-exist-binary'), [], cwd);

    expect(result).toEqual({ exitCode: 1, stdout: '', stderr: '' });
  });
});
