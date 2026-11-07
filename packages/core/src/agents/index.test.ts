import { describe, expect, it } from 'vitest';
import * as agents from './index.js';

describe('agents public API', () => {
  it('exports the generic CLI process adapter, the HTTP adapter, and the router', () => {
    expect(agents.CliProcessAgentAdapter).toBeTypeOf('function');
    expect(agents.HttpAgentAdapter).toBeTypeOf('function');
    expect(agents.AgentRouter).toBeTypeOf('function');
  });

  it('exports the ollama OpenAI-compatible endpoint', () => {
    expect(agents.ollamaEndpoint.name).toBe('ollama');
  });

  it('exports the three named agent CLI specs', () => {
    expect(agents.claudeCodeCliSpec.name).toBe('claude_code');
    expect(agents.copilotCliSpec.name).toBe('copilot_cli');
    expect(agents.antigravityCliSpec.name).toBe('antigravity');
  });

  it('exports the unknown-agent domain error type', () => {
    expect(agents.UnknownAgentError).toBeTypeOf('function');
  });
});
