export interface CommandResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface CliCommand {
  readonly name: string;
  readonly summary: string;
  run(args: readonly string[]): Promise<CommandResult>;
}
