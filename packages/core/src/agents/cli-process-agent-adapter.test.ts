import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CliProcessAgentAdapter } from './cli-process-agent-adapter.js';
import type { AgentCliSpec, AgentInvocationRequest } from './types.js';

describe('CliProcessAgentAdapter', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'orquestia-agent-'));
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it('exposes the spec name and captures stdout on a successful invocation', async () => {
    const spec: AgentCliSpec = {
      name: 'claude_code',
      executable: process.execPath,
      buildArgs: (request) => [
        '-e',
        `process.stdout.write(${JSON.stringify('got:')} + ${JSON.stringify('x')})`,
        request.prompt,
      ],
    };
    const adapter = new CliProcessAgentAdapter(spec);
    const request: AgentInvocationRequest = { branch: '2A', cwd, prompt: 'build the domain model' };

    const result = await adapter.invoke(request);

    expect(adapter.name).toBe('claude_code');
    expect(result).toEqual({ agent: 'claude_code', exitCode: 0, stdout: 'got:x', stderr: '' });
  });

  it('runs the process with its cwd set to the invocation request cwd', async () => {
    const spec: AgentCliSpec = {
      name: 'copilot_cli',
      executable: process.execPath,
      buildArgs: () => ['-e', 'process.stdout.write(process.cwd())'],
    };
    const adapter = new CliProcessAgentAdapter(spec);

    const result = await adapter.invoke({ branch: '2B', cwd, prompt: 'scaffold the tests' });

    // The spawned process reports its *real* cwd, which on macOS resolves
    // the /var symlink to /private/var — resolve both sides before comparing.
    expect(await realpath(result.stdout)).toBe(await realpath(cwd));
  });

  it('passes buildArgs output through to the spawned process', async () => {
    const spec: AgentCliSpec = {
      name: 'claude_code',
      executable: process.execPath,
      buildArgs: () => [
        '-e',
        'process.stderr.write(process.argv.slice(1).join("|"))',
        'arg-one',
        'arg-two',
      ],
    };
    const adapter = new CliProcessAgentAdapter(spec);

    const result = await adapter.invoke({ branch: '2A', cwd, prompt: 'noop' });

    expect(result.stderr).toBe('arg-one|arg-two');
  });

  it('reports a non-zero exit code and captured output on failure', async () => {
    const spec: AgentCliSpec = {
      name: 'antigravity',
      executable: process.execPath,
      buildArgs: () => [
        '-e',
        'process.stdout.write("partial"); process.stderr.write("boom"); process.exit(7)',
      ],
    };
    const adapter = new CliProcessAgentAdapter(spec);

    const result = await adapter.invoke({ branch: '2B', cwd, prompt: 'noop' });

    expect(result).toEqual({
      agent: 'antigravity',
      exitCode: 7,
      stdout: 'partial',
      stderr: 'boom',
    });
  });

  it('falls back to exit code 1 with empty output when the executable cannot be spawned at all', async () => {
    const spec: AgentCliSpec = {
      name: 'antigravity',
      executable: join(cwd, 'does-not-exist-binary'),
      buildArgs: () => [],
    };
    const adapter = new CliProcessAgentAdapter(spec);

    const result = await adapter.invoke({ branch: '2A', cwd, prompt: 'noop' });

    expect(result).toEqual({ agent: 'antigravity', exitCode: 1, stdout: '', stderr: '' });
  });
});
