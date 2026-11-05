import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { CommandResult, CommandRunnerPort } from './types.js';

const execAsync = promisify(exec);

interface ExecError {
  readonly code?: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

/**
 * Runs a harness command (`FORMAT_CHECK_CMD`, `BUILD_AND_LINT_CMD`, etc.) in
 * a real shell inside the worktree, capturing its exit code and output
 * instead of throwing on a non-zero exit.
 */
export class ShellCommandRunner implements CommandRunnerPort {
  constructor(private readonly cwd: string) {}

  async run(command: string): Promise<CommandResult> {
    try {
      const { stdout, stderr } = await execAsync(command, { cwd: this.cwd });
      return { exitCode: 0, stdout, stderr };
    } catch (error) {
      // node:child_process rejects with an Error carrying code/stdout/stderr.
      // `code` is null instead of a number when the process was terminated
      // by a signal rather than exiting normally.
      const execError = error as ExecError;
      return {
        exitCode: execError.code ?? 1,
        stdout: execError.stdout,
        stderr: execError.stderr,
      };
    }
  }
}
