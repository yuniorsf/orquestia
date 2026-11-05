import { describe, expect, it } from 'vitest';
import { antigravityCliSpec, claudeCodeCliSpec, copilotCliSpec } from './agent-cli-specs.js';
import type { AgentInvocationRequest } from './types.js';

const request: AgentInvocationRequest = {
  branch: '2A',
  cwd: '/worktrees/ORQ-99-example',
  prompt: 'implement the domain model',
};

describe('claudeCodeCliSpec', () => {
  it('names the claude executable and passes the prompt via -p', () => {
    expect(claudeCodeCliSpec.name).toBe('claude_code');
    expect(claudeCodeCliSpec.executable).toBe('claude');
    expect(claudeCodeCliSpec.buildArgs(request)).toEqual(['-p', request.prompt]);
  });
});

describe('copilotCliSpec', () => {
  it('names the copilot executable and passes the prompt plus --allow-all-tools', () => {
    expect(copilotCliSpec.name).toBe('copilot_cli');
    expect(copilotCliSpec.executable).toBe('copilot');
    expect(copilotCliSpec.buildArgs(request)).toEqual(['-p', request.prompt, '--allow-all-tools']);
  });
});

describe('antigravityCliSpec', () => {
  it('names the antigravity executable and follows the shared -p prompt convention', () => {
    expect(antigravityCliSpec.name).toBe('antigravity');
    expect(antigravityCliSpec.executable).toBe('antigravity');
    expect(antigravityCliSpec.buildArgs(request)).toEqual(['-p', request.prompt]);
  });
});
