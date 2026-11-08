import { describe, expect, it } from 'vitest';
import { AgentRouter } from '../agents/agent-router.js';
import { FakeAgentAdapter, FakeClock } from '../agents/test-builders.js';
import { AgentCodeSynthesisDispatcher } from './agent-code-synthesis-dispatcher.js';
import { FakeFileWriterPort } from './test-builders.js';
import { MalformedSynthesisOutputError } from './synthesis-json-protocol.js';

const ROUTING = { branch2a: 'claude_code' as const, branch2b: 'copilot_cli' as const };
const WORKTREE = { taskId: 'ORQ-35', path: '/worktrees/ORQ-35', branch: 'orq-35' };

function jsonOutput(stdout: string) {
  return () => ({ agent: 'claude_code' as const, exitCode: 0, stdout, stderr: '' });
}

describe('AgentCodeSynthesisDispatcher', () => {
  it('dispatches, parses, writes the files, and reports filesWritten', async () => {
    const adapterA = new FakeAgentAdapter(
      'claude_code',
      jsonOutput('{"files":[{"path":"src/foo.ts","content":"export const x = 1;"}]}'),
    );
    const router = new AgentRouter([adapterA], ROUTING, new FakeClock());
    const fileWriter = new FakeFileWriterPort();
    const dispatcher = new AgentCodeSynthesisDispatcher(router, fileWriter);

    const output = await dispatcher.synthesize('2A', WORKTREE, [
      { path: 'src/foo.ts', kind: 'NEW' },
    ]);

    expect(output).toEqual({ branch: '2A', filesWritten: ['src/foo.ts'] });
    expect(fileWriter.written).toEqual([
      { path: '/worktrees/ORQ-35/src/foo.ts', content: 'export const x = 1;' },
    ]);
    expect(adapterA.calls[0]?.prompt).toContain('[NEW] src/foo.ts');
  });

  it('omits any task description from the prompt when none is given (ORQ-47) — unchanged code behavior', async () => {
    const adapterA = new FakeAgentAdapter(
      'claude_code',
      jsonOutput('{"files":[{"path":"src/foo.ts","content":"x"}]}'),
    );
    const router = new AgentRouter([adapterA], ROUTING, new FakeClock());
    const dispatcher = new AgentCodeSynthesisDispatcher(router, new FakeFileWriterPort());

    await dispatcher.synthesize('2A', WORKTREE, [{ path: 'src/foo.ts', kind: 'NEW' }]);

    expect(adapterA.calls[0]?.prompt).toBe(
      'You are Branch 2A of the Coding DAG. Write the full contents of exactly these files:\n' +
        '- [NEW] src/foo.ts\n' +
        'Do not use any tools — just generate the content as text.\n' +
        'Respond with ONLY a single JSON object, no markdown fences and no commentary, of this exact shape:\n' +
        '{"files":[{"path":"<repo-relative path>","content":"<full file contents>"}]}',
    );
  });

  it('includes the task description in the prompt when provided (ORQ-47)', async () => {
    const adapterA = new FakeAgentAdapter(
      'claude_code',
      jsonOutput('{"files":[{"path":"src/foo.ts","content":"x"}]}'),
    );
    const router = new AgentRouter([adapterA], ROUTING, new FakeClock());
    const dispatcher = new AgentCodeSynthesisDispatcher(
      router,
      new FakeFileWriterPort(),
      'add a retry flag',
    );

    await dispatcher.synthesize('2A', WORKTREE, [{ path: 'src/foo.ts', kind: 'NEW' }]);

    expect(adapterA.calls[0]?.prompt).toContain('for task: add a retry flag');
  });

  it('propagates a malformed response as MalformedSynthesisOutputError', async () => {
    const adapterA = new FakeAgentAdapter('claude_code', jsonOutput('not json'));
    const router = new AgentRouter([adapterA], ROUTING, new FakeClock());
    const dispatcher = new AgentCodeSynthesisDispatcher(router, new FakeFileWriterPort());

    await expect(dispatcher.synthesize('2A', WORKTREE, [])).rejects.toThrow(
      MalformedSynthesisOutputError,
    );
  });
});
