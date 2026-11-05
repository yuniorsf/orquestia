import type { CliCommand, CommandResult } from './types.js';

/**
 * Placeholder for a command whose full wiring is blocked on work not yet
 * built (a concrete adapter, a native dependency, or the background
 * daemon). Registered so `--help` accurately lists the complete command
 * surface without claiming functionality that doesn't exist yet.
 */
export class PendingCommand implements CliCommand {
  constructor(
    readonly name: string,
    readonly summary: string,
    private readonly blockedOn: string,
  ) {}

  async run(): Promise<CommandResult> {
    return {
      exitCode: 1,
      stdout: '',
      stderr: `"${this.name}" is not available yet — blocked on ${this.blockedOn}.\n`,
    };
  }
}
