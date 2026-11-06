import { describe, expect, it } from 'vitest';
import { AgentRouter } from '../agents/agent-router.js';
import { FakeAgentAdapter } from '../agents/test-builders.js';
import {
  AgentSpecialistDispatcher,
  MalformedSpecialistOutputError,
} from './agent-specialist-dispatcher.js';

const ROUTING = { branch2a: 'claude_code' as const, branch2b: 'copilot_cli' as const };

function jsonOutput(stdout: string) {
  return () => ({ agent: 'claude_code' as const, exitCode: 0, stdout, stderr: '' });
}

describe('AgentSpecialistDispatcher', () => {
  it('parses a well-formed JSON response into a SpecialistOutput', async () => {
    const adapterA = new FakeAgentAdapter(
      'claude_code',
      jsonOutput(
        '{"fileManifest":[{"path":"src/foo.ts","kind":"NEW"}],"codeSnippets":["const x = 1;"]}',
      ),
    );
    const router = new AgentRouter([adapterA], ROUTING);
    const dispatcher = new AgentSpecialistDispatcher(router, '/repo', 'ORQ-34');

    const output = await dispatcher.dispatch('2A');

    expect(output).toEqual({
      branch: '2A',
      fileManifest: [{ path: 'src/foo.ts', kind: 'NEW' }],
      codeSnippets: ['const x = 1;'],
    });
    expect(adapterA.calls[0]).toEqual({
      branch: '2A',
      cwd: '/repo',
      prompt: expect.stringContaining('Branch 2A'),
    });
  });

  it('strips a ```json markdown fence before parsing', async () => {
    const adapterB = new FakeAgentAdapter(
      'copilot_cli',
      jsonOutput('```json\n{"fileManifest":[],"codeSnippets":[]}\n```'),
    );
    const router = new AgentRouter([adapterB], ROUTING);
    const dispatcher = new AgentSpecialistDispatcher(router, '/repo', 'ORQ-34');

    const output = await dispatcher.dispatch('2B');

    expect(output).toEqual({ branch: '2B', fileManifest: [], codeSnippets: [] });
  });

  it('extracts the JSON object even when the model adds prose around it', async () => {
    const adapterB = new FakeAgentAdapter(
      'copilot_cli',
      jsonOutput(
        'Here is my analysis:\n\n{"fileManifest":[],"codeSnippets":[]}\n\nLet me know if you need anything else!',
      ),
    );
    const router = new AgentRouter([adapterB], ROUTING);
    const dispatcher = new AgentSpecialistDispatcher(router, '/repo', 'ORQ-34');

    const output = await dispatcher.dispatch('2B');

    expect(output).toEqual({ branch: '2B', fileManifest: [], codeSnippets: [] });
  });

  it('throws MalformedSpecialistOutputError on invalid JSON', async () => {
    const adapterA = new FakeAgentAdapter('claude_code', jsonOutput('not json at all'));
    const router = new AgentRouter([adapterA], ROUTING);
    const dispatcher = new AgentSpecialistDispatcher(router, '/repo', 'ORQ-34');

    await expect(dispatcher.dispatch('2A')).rejects.toThrow(MalformedSpecialistOutputError);
  });

  it('throws when fileManifest or codeSnippets is missing/not an array', async () => {
    const adapterA = new FakeAgentAdapter('claude_code', jsonOutput('{"fileManifest":[]}'));
    const router = new AgentRouter([adapterA], ROUTING);
    const dispatcher = new AgentSpecialistDispatcher(router, '/repo', 'ORQ-34');

    await expect(dispatcher.dispatch('2A')).rejects.toThrow(MalformedSpecialistOutputError);
  });

  it('throws when a fileManifest entry has an invalid path or kind', async () => {
    const adapterA = new FakeAgentAdapter(
      'claude_code',
      jsonOutput('{"fileManifest":[{"path":"x","kind":"DELETE"}],"codeSnippets":[]}'),
    );
    const router = new AgentRouter([adapterA], ROUTING);
    const dispatcher = new AgentSpecialistDispatcher(router, '/repo', 'ORQ-34');

    await expect(dispatcher.dispatch('2A')).rejects.toThrow(MalformedSpecialistOutputError);
  });

  it('throws when a codeSnippets entry is not a string', async () => {
    const adapterA = new FakeAgentAdapter(
      'claude_code',
      jsonOutput('{"fileManifest":[],"codeSnippets":[42]}'),
    );
    const router = new AgentRouter([adapterA], ROUTING);
    const dispatcher = new AgentSpecialistDispatcher(router, '/repo', 'ORQ-34');

    await expect(dispatcher.dispatch('2A')).rejects.toThrow(MalformedSpecialistOutputError);
  });
});
