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
    expect(claudeCodeCliSpec.buildArgs(request)).toEqual([
      '-p',
      request.prompt,
      '--permission-mode',
      'plan',
      '--permission-prompts',
      'none',
    ]);
  });

  it('restricts the dispatch to read-only plan mode (ORQ-54) — no unsupervised tool access', () => {
    const args = claudeCodeCliSpec.buildArgs(request);
    expect(args).toContain('--permission-mode');
    expect(args[args.indexOf('--permission-mode') + 1]).toBe('plan');
    expect(args).toContain('--permission-prompts');
    expect(args[args.indexOf('--permission-prompts') + 1]).toBe('none');
  });
});

describe('copilotCliSpec', () => {
  it('names the copilot executable and passes the prompt plus --allow-all-tools --silent', () => {
    expect(copilotCliSpec.name).toBe('copilot_cli');
    expect(copilotCliSpec.executable).toBe('copilot');
    expect(copilotCliSpec.buildArgs(request)).toEqual([
      '-p',
      request.prompt,
      '--allow-all-tools',
      '--silent',
    ]);
  });
});

describe('antigravityCliSpec', () => {
  it('keeps the logical agent name "antigravity" but points at the real agy binary', () => {
    expect(antigravityCliSpec.name).toBe('antigravity');
    expect(antigravityCliSpec.executable).toBe('agy');
  });

  it('passes the prompt via -p plus --mode plan --dangerously-skip-permissions --output-format json', () => {
    expect(antigravityCliSpec.buildArgs(request)).toEqual([
      '-p',
      request.prompt,
      '--mode',
      'plan',
      '--dangerously-skip-permissions',
      '--output-format',
      'json',
    ]);
  });

  describe('extractResponse', () => {
    it('unwraps the "response" field from a successful agy --output-format json envelope', () => {
      const rawStdout = JSON.stringify({
        conversation_id: 'abc',
        status: 'SUCCESS',
        response: '{"fileManifest":[],"codeSnippets":[]}\n',
      });

      expect(antigravityCliSpec.extractResponse?.(rawStdout)).toBe(
        '{"fileManifest":[],"codeSnippets":[]}\n',
      );
    });

    it('falls back to the raw text unchanged when it is not valid JSON', () => {
      expect(antigravityCliSpec.extractResponse?.('not json at all')).toBe('not json at all');
    });

    it('falls back to the raw text unchanged when "response" is missing or not a string', () => {
      const rawStdout = JSON.stringify({ status: 'ERROR', conversation_id: 'abc' });

      expect(antigravityCliSpec.extractResponse?.(rawStdout)).toBe(rawStdout);
    });
  });
});
