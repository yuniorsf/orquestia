import type { DispatchTraceEvent, TraceSinkPort } from '@orquestia/core';

export type VerbosityLevel = 0 | 1 | 2 | 3;

function prefixLines(label: string, text: string): string {
  if (text.length === 0) {
    return '';
  }
  return `${text
    .split('\n')
    .map((line) => `${label} | ${line}`)
    .join('\n')}\n`;
}

/**
 * Terminal-writing {@link TraceSinkPort}: level 1 prints a start/complete
 * line per dispatch, level 2 adds the agent's full captured stdout/stderr,
 * level 3 additionally echoes the prompt sent to it. Level 0 is never
 * constructed by the CLI (see `main.ts`'s `runCli`), so this class has no
 * "off" branch of its own to test.
 */
export class ConsoleTraceSink implements TraceSinkPort {
  constructor(
    private readonly level: VerbosityLevel,
    private readonly write: (line: string) => void,
  ) {}

  onDispatchEvent(event: DispatchTraceEvent): void {
    const label = `[${event.branch}→${event.agent}]`;

    if (event.phase === 'start') {
      this.write(`${label} dispatching...\n`);
      if (this.level >= 3) {
        this.write(prefixLines(label, event.prompt));
      }
      return;
    }

    this.write(`${label} done in ${event.durationMs}ms, exit ${event.exitCode}\n`);
    if (this.level >= 2) {
      this.write(prefixLines(label, event.stdout));
      this.write(prefixLines(label, event.stderr));
    }
  }
}
