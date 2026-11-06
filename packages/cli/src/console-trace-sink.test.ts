import { describe, expect, it } from 'vitest';
import { ConsoleTraceSink } from './console-trace-sink.js';

function collectLines() {
  const lines: string[] = [];
  const sink = (line: string) => lines.push(line);
  return { lines, sink };
}

describe('ConsoleTraceSink', () => {
  it('level 1 prints start/complete lines without stdout/stderr/prompt', () => {
    const { lines, sink } = collectLines();
    const trace = new ConsoleTraceSink(1, sink);

    trace.onDispatchEvent({
      phase: 'start',
      branch: '2A',
      agent: 'claude_code',
      prompt: 'secret prompt',
    });
    trace.onDispatchEvent({
      phase: 'complete',
      branch: '2A',
      agent: 'claude_code',
      exitCode: 0,
      stdout: 'secret stdout',
      stderr: '',
      durationMs: 42,
    });

    const output = lines.join('');
    expect(output).toContain('[2A→claude_code] dispatching...');
    expect(output).toContain('[2A→claude_code] done in 42ms, exit 0');
    expect(output).not.toContain('secret prompt');
    expect(output).not.toContain('secret stdout');
  });

  it('level 2 adds full stdout/stderr, line-prefixed, but not the prompt', () => {
    const { lines, sink } = collectLines();
    const trace = new ConsoleTraceSink(2, sink);

    trace.onDispatchEvent({
      phase: 'start',
      branch: '2B',
      agent: 'copilot_cli',
      prompt: 'hidden prompt',
    });
    trace.onDispatchEvent({
      phase: 'complete',
      branch: '2B',
      agent: 'copilot_cli',
      exitCode: 1,
      stdout: 'line one\nline two',
      stderr: 'oops',
      durationMs: 7,
    });

    const output = lines.join('');
    expect(output).toContain('[2B→copilot_cli] | line one');
    expect(output).toContain('[2B→copilot_cli] | line two');
    expect(output).toContain('[2B→copilot_cli] | oops');
    expect(output).not.toContain('hidden prompt');
  });

  it('level 3 also echoes the prompt sent to the agent', () => {
    const { lines, sink } = collectLines();
    const trace = new ConsoleTraceSink(3, sink);

    trace.onDispatchEvent({
      phase: 'start',
      branch: '2A',
      agent: 'claude_code',
      prompt: 'the full prompt',
    });

    expect(lines.join('')).toContain('[2A→claude_code] | the full prompt');
  });

  it('omits an empty stdout/stderr section instead of printing a bare label line', () => {
    const { lines, sink } = collectLines();
    const trace = new ConsoleTraceSink(2, sink);

    trace.onDispatchEvent({
      phase: 'complete',
      branch: '2A',
      agent: 'claude_code',
      exitCode: 0,
      stdout: '',
      stderr: '',
      durationMs: 3,
    });

    expect(lines.join('')).toBe('[2A→claude_code] done in 3ms, exit 0\n');
  });
});
