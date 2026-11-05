import type { CliCommand, CommandResult } from './types.js';

/**
 * Dispatches `orquestia <command> [args...]` to the matching registered
 * {@link CliCommand}, or renders `--help` listing every registered command.
 * Never throws — every outcome (help, unknown command, or a command's own
 * result) is reported through the returned {@link CommandResult}.
 */
export class CommandRouter {
  private readonly commandsByName: ReadonlyMap<string, CliCommand>;

  constructor(private readonly commands: readonly CliCommand[]) {
    this.commandsByName = new Map(commands.map((command) => [command.name, command]));
  }

  async run(argv: readonly string[]): Promise<CommandResult> {
    const [commandName, ...rest] = argv;

    if (!commandName || commandName === '--help' || commandName === '-h') {
      return { exitCode: 0, stdout: this.renderHelp(), stderr: '' };
    }

    const command = this.commandsByName.get(commandName);
    if (!command) {
      return {
        exitCode: 1,
        stdout: '',
        stderr: `Unknown command "${commandName}". Run with --help to see available commands.\n`,
      };
    }

    return command.run(rest);
  }

  private renderHelp(): string {
    const lines = ['Usage: orquestia <command> [args...]', '', 'Commands:'];
    for (const command of this.commands) {
      lines.push(`  ${command.name.padEnd(12)} ${command.summary}`);
    }
    return `${lines.join('\n')}\n`;
  }
}
