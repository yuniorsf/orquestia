import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runCli } from './main.js';

describe('runCli', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'orquestia-cli-'));
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it('lists the full command surface on --help', async () => {
    const result = await runCli(['--help'], cwd);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('approvals');
    expect(result.stdout).toContain('plan');
    expect(result.stdout).toContain('code');
    expect(result.stdout).toContain('auth');
    expect(result.stdout).toContain('queue');
  });

  it('reports "not available yet" for a pending command', async () => {
    const result = await runCli(['queue'], cwd);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('"queue" is not available yet');
  });

  it('reports an unknown command', async () => {
    const result = await runCli(['bogus'], cwd);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Unknown command "bogus"');
  });

  it('wires the approvals command to a real durable JSON store under <cwd>/.orquestia', async () => {
    const requested = await runCli(['approvals', 'request', 'task-1', 'before_coding'], cwd);
    expect(requested.exitCode).toBe(0);
    expect(requested.stdout).toBe('task-1 before_coding pending (mode=prompt)\n');

    const persisted = JSON.parse(await readFile(join(cwd, '.orquestia', 'state.json'), 'utf8')) as {
      records: unknown[];
    };
    expect(persisted.records).toHaveLength(1);

    const approved = await runCli(['approvals', 'approve', 'task-1', 'before_coding'], cwd);
    expect(approved.exitCode).toBe(0);
    expect(approved.stdout).toBe('task-1 before_coding approved (mode=prompt)\n');
  });
});
