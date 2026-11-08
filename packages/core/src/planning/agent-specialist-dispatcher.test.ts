import { describe, expect, it } from 'vitest';
import { AgentRouter } from '../agents/agent-router.js';
import { FakeAgentAdapter, FakeClock } from '../agents/test-builders.js';
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
    const router = new AgentRouter([adapterA], ROUTING, new FakeClock());
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

  it('asks Branch 2A, but not Branch 2B, to wire new units in (ORQ-53)', async () => {
    const adapterA = new FakeAgentAdapter(
      'claude_code',
      jsonOutput('{"fileManifest":[],"codeSnippets":[]}'),
    );
    const adapterB = new FakeAgentAdapter(
      'copilot_cli',
      jsonOutput('{"fileManifest":[],"codeSnippets":[]}'),
    );
    const router = new AgentRouter([adapterA, adapterB], ROUTING, new FakeClock());
    const dispatcher = new AgentSpecialistDispatcher(router, '/repo', 'ORQ-34');

    await dispatcher.dispatch('2A');
    await dispatcher.dispatch('2B');

    expect(adapterA.calls[0]?.prompt).toContain('register or wire it in');
    expect(adapterB.calls[0]?.prompt).not.toContain('register or wire it in');
  });

  it('defaults taskDescription to taskId when omitted (ORQ-47) — unchanged plan/code behavior', async () => {
    const adapterA = new FakeAgentAdapter(
      'claude_code',
      jsonOutput('{"fileManifest":[],"codeSnippets":[]}'),
    );
    const router = new AgentRouter([adapterA], ROUTING, new FakeClock());
    const dispatcher = new AgentSpecialistDispatcher(router, '/repo', 'ORQ-34');

    await dispatcher.dispatch('2A');

    expect(adapterA.calls[0]?.prompt).toContain('task "ORQ-34"');
  });

  it('uses the free-text taskDescription instead of taskId when provided (ORQ-47)', async () => {
    const adapterA = new FakeAgentAdapter(
      'claude_code',
      jsonOutput('{"fileManifest":[],"codeSnippets":[]}'),
    );
    const router = new AgentRouter([adapterA], ROUTING, new FakeClock());
    const dispatcher = new AgentSpecialistDispatcher(
      router,
      '/repo',
      'ORQ-34',
      'add a retry flag to the client',
    );

    await dispatcher.dispatch('2A');

    expect(adapterA.calls[0]?.prompt).toContain('task "add a retry flag to the client"');
    expect(adapterA.calls[0]?.prompt).not.toContain('task "ORQ-34"');
  });

  it('uses taskDescription, not taskId, in remediate prompts too (ORQ-47)', async () => {
    const adapterB = new FakeAgentAdapter(
      'copilot_cli',
      jsonOutput('{"fileManifest":[],"codeSnippets":[]}'),
    );
    const router = new AgentRouter([adapterB], ROUTING, new FakeClock());
    const dispatcher = new AgentSpecialistDispatcher(router, '/repo', 'ORQ-34', 'free text task');

    await dispatcher.remediate(['a.ts']);

    expect(adapterB.calls[0]?.prompt).toContain('task "free text task"');
  });

  it('strips a ```json markdown fence before parsing', async () => {
    const adapterB = new FakeAgentAdapter(
      'copilot_cli',
      jsonOutput('```json\n{"fileManifest":[],"codeSnippets":[]}\n```'),
    );
    const router = new AgentRouter([adapterB], ROUTING, new FakeClock());
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
    const router = new AgentRouter([adapterB], ROUTING, new FakeClock());
    const dispatcher = new AgentSpecialistDispatcher(router, '/repo', 'ORQ-34');

    const output = await dispatcher.dispatch('2B');

    expect(output).toEqual({ branch: '2B', fileManifest: [], codeSnippets: [] });
  });

  it('extracts the JSON object past tool-call transcript noise containing its own braces', async () => {
    const adapterB = new FakeAgentAdapter(
      'copilot_cli',
      jsonOutput(
        [
          "$ Shell cat config.ts && echo '{ not: json }'",
          '{ not: json }',
          '{"fileManifest":[{"path":"a.ts","kind":"NEW"}],"codeSnippets":[]}',
        ].join('\n'),
      ),
    );
    const router = new AgentRouter([adapterB], ROUTING, new FakeClock());
    const dispatcher = new AgentSpecialistDispatcher(router, '/repo', 'ORQ-34');

    const output = await dispatcher.dispatch('2B');

    expect(output).toEqual({
      branch: '2B',
      fileManifest: [{ path: 'a.ts', kind: 'NEW' }],
      codeSnippets: [],
    });
  });

  it('throws MalformedSpecialistOutputError on invalid JSON', async () => {
    const adapterA = new FakeAgentAdapter('claude_code', jsonOutput('not json at all'));
    const router = new AgentRouter([adapterA], ROUTING, new FakeClock());
    const dispatcher = new AgentSpecialistDispatcher(router, '/repo', 'ORQ-34');

    await expect(dispatcher.dispatch('2A')).rejects.toThrow(MalformedSpecialistOutputError);
  });

  it('throws when fileManifest or codeSnippets is missing/not an array', async () => {
    const adapterA = new FakeAgentAdapter('claude_code', jsonOutput('{"fileManifest":[]}'));
    const router = new AgentRouter([adapterA], ROUTING, new FakeClock());
    const dispatcher = new AgentSpecialistDispatcher(router, '/repo', 'ORQ-34');

    await expect(dispatcher.dispatch('2A')).rejects.toThrow(MalformedSpecialistOutputError);
  });

  it('throws when a fileManifest entry has an invalid path or kind', async () => {
    const adapterA = new FakeAgentAdapter(
      'claude_code',
      jsonOutput('{"fileManifest":[{"path":"x","kind":"DELETE"}],"codeSnippets":[]}'),
    );
    const router = new AgentRouter([adapterA], ROUTING, new FakeClock());
    const dispatcher = new AgentSpecialistDispatcher(router, '/repo', 'ORQ-34');

    await expect(dispatcher.dispatch('2A')).rejects.toThrow(MalformedSpecialistOutputError);
  });

  it('throws when a codeSnippets entry is not a string', async () => {
    const adapterA = new FakeAgentAdapter(
      'claude_code',
      jsonOutput('{"fileManifest":[],"codeSnippets":[42]}'),
    );
    const router = new AgentRouter([adapterA], ROUTING, new FakeClock());
    const dispatcher = new AgentSpecialistDispatcher(router, '/repo', 'ORQ-34');

    await expect(dispatcher.dispatch('2A')).rejects.toThrow(MalformedSpecialistOutputError);
  });

  describe('remediate', () => {
    it('always dispatches Branch 2B, naming the overlapping paths in the prompt', async () => {
      const adapterB = new FakeAgentAdapter(
        'copilot_cli',
        jsonOutput('{"fileManifest":[{"path":"b.test.ts","kind":"NEW"}],"codeSnippets":[]}'),
      );
      const router = new AgentRouter([adapterB], ROUTING, new FakeClock());
      const dispatcher = new AgentSpecialistDispatcher(router, '/repo', 'ORQ-34');

      const output = await dispatcher.remediate(['a.ts', 'b.ts']);

      expect(output).toEqual({
        branch: '2B',
        fileManifest: [{ path: 'b.test.ts', kind: 'NEW' }],
        codeSnippets: [],
      });
      expect(adapterB.calls[0]).toEqual({
        branch: '2B',
        cwd: '/repo',
        prompt: expect.stringContaining('a.ts, b.ts'),
      });
    });

    it('throws MalformedSpecialistOutputError on an invalid remediation response, same as dispatch', async () => {
      const adapterB = new FakeAgentAdapter('copilot_cli', jsonOutput('not json'));
      const router = new AgentRouter([adapterB], ROUTING, new FakeClock());
      const dispatcher = new AgentSpecialistDispatcher(router, '/repo', 'ORQ-34');

      await expect(dispatcher.remediate(['a.ts'])).rejects.toThrow(MalformedSpecialistOutputError);
    });
  });
});
