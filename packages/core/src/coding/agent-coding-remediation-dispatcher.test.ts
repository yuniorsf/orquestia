import { describe, expect, it } from 'vitest';
import { AgentRouter } from '../agents/agent-router.js';
import { FakeAgentAdapter } from '../agents/test-builders.js';
import { AgentCodingRemediationDispatcher } from './agent-coding-remediation-dispatcher.js';
import { FakeCommandRunnerPort, FakeFileWriterPort } from './test-builders.js';
import type { OracleCommands } from './types.js';

const ROUTING = { branch2a: 'claude_code' as const, branch2b: 'copilot_cli' as const };
const WORKTREE = { taskId: 'ORQ-35', path: '/worktrees/ORQ-35', branch: 'orq-35' };
const COMMANDS: OracleCommands = {
  solidPreflight: 'solid-check',
  formatCheck: 'format-check',
  buildAndLint: 'build-and-lint',
  testRun: 'unit-tests',
};
const FORMAT_FIX_COMMAND = 'format-fix';

function jsonOutput(stdout: string) {
  return () => ({ agent: 'claude_code' as const, exitCode: 0, stdout, stderr: '' });
}

describe('AgentCodingRemediationDispatcher', () => {
  it('runs the deterministic format-fix command for exit code 10, without dispatching any agent', async () => {
    const adapterB = new FakeAgentAdapter('copilot_cli', jsonOutput('{"files":[]}'));
    const router = new AgentRouter([adapterB], ROUTING);
    const commandRunner = new FakeCommandRunnerPort({
      [FORMAT_FIX_COMMAND]: { exitCode: 0, stdout: '', stderr: '' },
    });
    const dispatcher = new AgentCodingRemediationDispatcher(
      commandRunner,
      router,
      new FakeFileWriterPort(),
      WORKTREE,
      COMMANDS,
      FORMAT_FIX_COMMAND,
    );

    await dispatcher.remediate(10, 'formatCheck');

    expect(commandRunner.calls).toEqual([FORMAT_FIX_COMMAND]);
    expect(adapterB.calls).toHaveLength(0);
  });

  it('re-runs the failed stage for fresh diagnostics and dispatches 2A for exit code 20', async () => {
    const adapterA = new FakeAgentAdapter(
      'claude_code',
      jsonOutput('{"files":[{"path":"src/fixed.ts","content":"fixed"}]}'),
    );
    const router = new AgentRouter([adapterA], ROUTING);
    const commandRunner = new FakeCommandRunnerPort({
      [COMMANDS.buildAndLint]: { exitCode: 1, stdout: 'TS2345: type error', stderr: '' },
    });
    const fileWriter = new FakeFileWriterPort();
    const dispatcher = new AgentCodingRemediationDispatcher(
      commandRunner,
      router,
      fileWriter,
      WORKTREE,
      COMMANDS,
      FORMAT_FIX_COMMAND,
    );

    await dispatcher.remediate(20, 'buildAndLint');

    expect(commandRunner.calls).toEqual([COMMANDS.buildAndLint]);
    expect(adapterA.calls[0]?.prompt).toContain('TS2345: type error');
    expect(fileWriter.written).toEqual([
      { path: '/worktrees/ORQ-35/src/fixed.ts', content: 'fixed' },
    ]);
  });

  it('dispatches 2A for exit code 30, falling back to stderr when the diagnostic run has empty stdout', async () => {
    const adapterA = new FakeAgentAdapter('claude_code', jsonOutput('{"files":[]}'));
    const router = new AgentRouter([adapterA], ROUTING);
    const commandRunner = new FakeCommandRunnerPort({
      [COMMANDS.testRun]: { exitCode: 1, stdout: '', stderr: 'test failed: expected 1 to be 2' },
    });
    const dispatcher = new AgentCodingRemediationDispatcher(
      commandRunner,
      router,
      new FakeFileWriterPort(),
      WORKTREE,
      COMMANDS,
      FORMAT_FIX_COMMAND,
    );

    await dispatcher.remediate(30, 'testRun');

    expect(adapterA.calls[0]?.prompt).toContain('test failed: expected 1 to be 2');
  });

  it('falls back to a placeholder when the diagnostic run has neither stdout nor stderr', async () => {
    const adapterA = new FakeAgentAdapter('claude_code', jsonOutput('{"files":[]}'));
    const router = new AgentRouter([adapterA], ROUTING);
    const commandRunner = new FakeCommandRunnerPort({
      [COMMANDS.testRun]: { exitCode: 1, stdout: '', stderr: '' },
    });
    const dispatcher = new AgentCodingRemediationDispatcher(
      commandRunner,
      router,
      new FakeFileWriterPort(),
      WORKTREE,
      COMMANDS,
      FORMAT_FIX_COMMAND,
    );

    await dispatcher.remediate(30, 'testRun');

    expect(adapterA.calls[0]?.prompt).toContain('(no output captured)');
  });
});
