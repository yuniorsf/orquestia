import type { CliCommand, CommandResult } from './types.js';

export interface ImplementCommandDependencies {
  /** Builds a fresh `CodeCommand`, wired so its dispatched agents see `taskDescription` instead of the bare taskId. */
  buildCodeCommand(taskDescription: string): CliCommand;
}

const USAGE = 'Usage: orquestia implement <taskId> "<prompt text>" [--ship]\n';

/**
 * `orquestia implement <taskId> "<prompt text>" [--ship]` (ORQ-47) — the
 * same Coding DAG pipeline as `orquestia code`, but dispatched agents see
 * the free-text `prompt` instead of the bare `taskId`. `taskId` stays
 * required and still names the worktree/branch (git-safe identifiers
 * can't be arbitrary prose); the prompt is everything after it.
 */
export class ImplementCommand implements CliCommand {
  readonly name = 'implement';
  readonly summary =
    'Run the Coding DAG for a free-text prompt (dispatched agents see the prompt, not the taskId)';

  constructor(private readonly deps: ImplementCommandDependencies) {}

  async run(args: readonly string[]): Promise<CommandResult> {
    const ship = args.includes('--ship');
    const [taskId, ...promptWords] = args.filter((arg) => arg !== '--ship');
    const prompt = promptWords.join(' ').trim();

    if (!taskId || prompt === '') {
      return { exitCode: 1, stdout: '', stderr: USAGE };
    }

    const codeCommand = this.deps.buildCodeCommand(prompt);
    return codeCommand.run(ship ? [taskId, '--ship'] : [taskId]);
  }
}
