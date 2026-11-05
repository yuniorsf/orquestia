import { describe, expect, it } from 'vitest';
import { AgentRouter } from './agent-router.js';
import { FakeAgentAdapter } from './test-builders.js';
import { UnknownAgentError, type AgentRoutingConfig } from './types.js';

function createRouter(routing: AgentRoutingConfig, adapters = [] as FakeAgentAdapter[]) {
  const claudeCode = new FakeAgentAdapter('claude_code');
  const copilotCli = new FakeAgentAdapter('copilot_cli');
  const registered = adapters.length > 0 ? adapters : [claudeCode, copilotCli];
  const router = new AgentRouter(registered, routing);
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
});
