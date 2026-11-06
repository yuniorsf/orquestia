import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { ProcessResult, ProcessRunner } from './types.js';

const execFileAsync = promisify(execFile);

interface ExecError {
  // `code` genuinely varies: a real non-zero exit gives a number, ENOENT
  // (executable not found) gives the string "ENOENT", and a signal kill
  // (e.g. a timeout) gives null.
  readonly code?: number | string | null;
  // Empirically, every child_process.execFile-family error — ENOENT,
  // timeout/killed, and a real non-zero exit — carries `stdout`/`stderr`
  // as defined strings (verified directly against this Node version, not
  // just vitest's test environment), so these are never optional here.
  readonly stdout: string;
  readonly stderr: string;
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
      return { exitCode, stdout: execError.stdout, stderr: execError.stderr };
    }
  }
}
