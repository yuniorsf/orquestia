import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { ProcessResult, ProcessRunner } from './types.js';

const execFileAsync = promisify(execFile);

interface ExecError {
  readonly code?: number | string | null;
  readonly stdout?: string;
  readonly stderr?: string;
}

/** Real `child_process.execFile`-backed {@link ProcessRunner} for SEA build steps. */
export class NodeProcessRunner implements ProcessRunner {
  async run(command: string, args: readonly string[], cwd: string): Promise<ProcessResult> {
    try {
      const { stdout, stderr } = await execFileAsync(command, [...args], { cwd });
      return { exitCode: 0, stdout, stderr };
    } catch (error) {
      const execError = error as ExecError;
      let exitCode = 1;
      if (typeof execError.code === 'number') {
        exitCode = execError.code;
      }
      let stdout = '';
      if (typeof execError.stdout === 'string') {
        stdout = execError.stdout;
      }
      let stderr = '';
      if (typeof execError.stderr === 'string') {
        stderr = execError.stderr;
      }
      return { exitCode, stdout, stderr };
    }
  }
}
