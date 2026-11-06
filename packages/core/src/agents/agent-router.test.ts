import { describe, expect, it } from 'vitest';
import { AgentRouter } from './agent-router.js';
import { FakeAgentAdapter, FakeClock } from './test-builders.js';
import { UnknownAgentError, type AgentRoutingConfig, type DispatchTraceEvent } from './types.js';

function createRouter(routing: AgentRoutingConfig, adapters = [] as FakeAgentAdapter[]) {
  const claudeCode = new FakeAgentAdapter('claude_code');
  const copilotCli = new FakeAgentAdapter('copilot_cli');
  const registered = adapters.length > 0 ? adapters : [claudeCode, copilotCli];
  const router = new AgentRouter(registered, routing, new FakeClock());
  return { router, claudeCode, copilotCli };
}

describe('AgentRouter.dispatch', () => {
  it('routes Branch 2A to the adapter configured for branch_2a', async () => {
    const { router, claudeCode } = createRouter({
      branch2a: 'claude_code',
      branch2b: 'copilot_cli',
    });

    const result = await router.dispatch('2A', { cwd: '/worktrees/task-1', prompt: 'build core' });

    expect(result.agent).toBe('claude_code');
    expect(claudeCode.calls).toEqual([
      { branch: '2A', cwd: '/worktrees/task-1', prompt: 'build core' },
    ]);
  });

  it('routes Branch 2B to the adapter configured for branch_2b', async () => {
    const { router, copilotCli } = createRouter({
      branch2a: 'claude_code',
      branch2b: 'copilot_cli',
    });

    const result = await router.dispatch('2B', {
      cwd: '/worktrees/task-1',
      prompt: 'scaffold tests',
    });

    expect(result.agent).toBe('copilot_cli');
    expect(copilotCli.calls).toEqual([
      { branch: '2B', cwd: '/worktrees/task-1', prompt: 'scaffold tests' },
    ]);
  });

  it('allows the same agent to be configured for both branches', async () => {
    const { router, claudeCode } = createRouter({
      branch2a: 'claude_code',
      branch2b: 'claude_code',
    });

    await router.dispatch('2A', { cwd: '/worktrees/task-1', prompt: 'a' });
    await router.dispatch('2B', { cwd: '/worktrees/task-1', prompt: 'b' });

    expect(claudeCode.calls.map((call) => call.branch)).toEqual(['2A', '2B']);
  });

  it('throws UnknownAgentError when the configured agent has no registered adapter', async () => {
    const { router } = createRouter({ branch2a: 'antigravity', branch2b: 'copilot_cli' }, [
      new FakeAgentAdapter('copilot_cli'),
    ]);

    await expect(
      router.dispatch('2A', { cwd: '/worktrees/task-1', prompt: 'noop' }),
    ).rejects.toThrow(UnknownAgentError);
  });

  it('never calls an unspecified trace sink (omitting it leaves dispatch unchanged)', async () => {
    const { router } = createRouter({ branch2a: 'claude_code', branch2b: 'copilot_cli' });

    const result = await router.dispatch('2A', { cwd: '/worktrees/task-1', prompt: 'build core' });

    expect(result.agent).toBe('claude_code');
  });

  it('emits start then complete trace events, with durationMs from the injected clock', async () => {
    const claudeCode = new FakeAgentAdapter('claude_code', () => ({
      agent: 'claude_code',
      exitCode: 0,
      stdout: 'ok',
      stderr: '',
    }));
    const clock = new FakeClock(1000);
    const events: DispatchTraceEvent[] = [];
    const router = new AgentRouter(
      [claudeCode],
      { branch2a: 'claude_code', branch2b: 'claude_code' },
      clock,
      { onDispatchEvent: (event) => events.push(event) },
    );

    clock.advanceTo(1000);
    const dispatchPromise = router.dispatch('2A', {
      cwd: '/worktrees/task-1',
      prompt: 'build core',
    });
    clock.advanceTo(1250);
    await dispatchPromise;

    expect(events).toEqual([
      { phase: 'start', branch: '2A', agent: 'claude_code', prompt: 'build core' },
      {
        phase: 'complete',
        branch: '2A',
        agent: 'claude_code',
        exitCode: 0,
        stdout: 'ok',
        stderr: '',
        durationMs: 250,
      },
    ]);
  });

  it('still emits a complete event with the trace sink when the adapter result is a failure', async () => {
    const copilotCli = new FakeAgentAdapter('copilot_cli', () => ({
      agent: 'copilot_cli',
      exitCode: 2,
      stdout: '',
      stderr: 'boom',
    }));
    const events: DispatchTraceEvent[] = [];
    const router = new AgentRouter(
      [copilotCli],
      { branch2a: 'copilot_cli', branch2b: 'copilot_cli' },
      new FakeClock(),
      { onDispatchEvent: (event) => events.push(event) },
    );

    await router.dispatch('2B', { cwd: '/worktrees/task-1', prompt: 'scaffold tests' });

    expect(events[1]).toMatchObject({ phase: 'complete', exitCode: 2, stderr: 'boom' });
  });
});
