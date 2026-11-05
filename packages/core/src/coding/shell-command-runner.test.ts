import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ShellCommandRunner } from './shell-command-runner.js';

describe('ShellCommandRunner', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'orquestia-shell-'));
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it('returns exit code 0 with captured stdout on success', async () => {
    const runner = new ShellCommandRunner(cwd);

    const result = await runner.run('echo hello');

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('hello');
  });

  it('captures a non-zero exit code and stderr without throwing', async () => {
    const runner = new ShellCommandRunner(cwd);

    const result = await runner.run('echo failure-message >&2; exit 7');

    expect(result.exitCode).toBe(7);
    expect(result.stderr.trim()).toBe('failure-message');
  });

  it('defaults to exit code 1 when the process is terminated by a signal', async () => {
    // A signal-terminated process rejects with a null .code (not a numeric
    // exit code) — exercises the nullish-coalescing fallback.
    const runner = new ShellCommandRunner(cwd);

    const result = await runner.run('kill -TERM $$');

    expect(result.exitCode).toBe(1);
  });
});
