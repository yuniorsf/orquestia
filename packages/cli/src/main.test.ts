import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseVerbosity, runCli } from './main.js';

describe('parseVerbosity', () => {
  it('defaults to level 0 and leaves argv untouched when no flag is present', () => {
    expect(parseVerbosity(['code', 'task-1', '--ship'])).toEqual({
      level: 0,
      rest: ['code', 'task-1', '--ship'],
    });
  });

  it('reads stacked -v/-vv/-vvv shorthand and strips it from the result', () => {
    expect(parseVerbosity(['-vv', 'plan', 'task-1'])).toEqual({
      level: 2,
      rest: ['plan', 'task-1'],
    });
  });

  it('takes the highest level across repeated -v flags', () => {
    expect(parseVerbosity(['-v', 'code', 'task-1', '-vvv', '--ship'])).toEqual({
      level: 3,
      rest: ['code', 'task-1', '--ship'],
    });
  });

  it('reads --verbosity <n> and strips both tokens', () => {
    expect(parseVerbosity(['code', 'task-1', '--verbosity', '2'])).toEqual({
      level: 2,
      rest: ['code', 'task-1'],
    });
  });

  it('ignores an out-of-range --verbosity value, leaving both tokens in rest', () => {
    expect(parseVerbosity(['code', '--verbosity', '9'])).toEqual({
      level: 0,
      rest: ['code', '--verbosity', '9'],
    });
  });
});

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

  it('reports queue usage for a missing action', async () => {
    const result = await runCli(['queue'], cwd);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Usage: orquestia queue');
  });

  it('reports the daemon as not running when nothing is listening on its socket', async () => {
    const result = await runCli(['queue', 'status'], cwd);

    expect(result).toEqual({
      exitCode: 1,
      stdout: '',
      stderr: 'Orquestia daemon is not running.\n',
    });
  });

  it('reports an unknown command', async () => {
    const result = await runCli(['bogus'], cwd);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Unknown command "bogus"');
  });

  it('resolves agent routing from a real orquestia.config.yaml without throwing', async () => {
    await writeFile(
      join(cwd, 'orquestia.config.yaml'),
      [
        "version: '1.0'",
        "project_name: 'fixture'",
        'layers:',
        '  planning_architecture:',
        '    enabled: true',
        "    strategy: 'quota_aware'",
        '    primary_fallback: true',
        '    providers:',
        "      - name: 'antigravity_primary'",
        "        provider: 'antigravity'",
        "        base_url: 'cli://agy'",
        "        model: 'antigravity-default'",
        '        priority: 1',
        '  coding_scaffolding_tests:',
        '    enabled: false',
        "    strategy: 'least_cost'",
        '    primary_fallback: false',
        '    providers: []',
        '',
      ].join('\n'),
      'utf8',
    );

    const result = await runCli(['--help'], cwd);

    expect(result.exitCode).toBe(0);
  });

  it('strips a global -v flag before command routing, regardless of position', async () => {
    const result = await runCli(['-v', '--help'], cwd);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('plan');
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
