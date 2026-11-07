import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type {
  AgentAdapterPort,
  AgentCliSpec,
  AgentInvocationRequest,
  AgentInvocationResult,
  AgentName,
} from './types.js';

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

/**
 * Generic headless invocation of an agent CLI subscription (Claude Code,
 * GitHub Copilot CLI, Google Antigravity, ...), parameterized by an
 * {@link AgentCliSpec} so the executable and argument convention stay
 * configuration rather than hardcoded per-agent branching logic.
 */
export class CliProcessAgentAdapter implements AgentAdapterPort {
  readonly name: AgentName;

  constructor(private readonly spec: AgentCliSpec) {
    this.name = spec.name;
  }

  async invoke(request: AgentInvocationRequest): Promise<AgentInvocationResult> {
    const args = this.spec.buildArgs(request);
    try {
      const { stdout, stderr } = await execFileAsync(this.spec.executable, [...args], {
        cwd: request.cwd,
      });
      return { agent: this.name, exitCode: 0, stdout: this.extractResponse(stdout), stderr };
    } catch (error) {
      // node:child_process rejects with an Error carrying code/stdout/stderr.
      // `code` is a string (e.g. "ENOENT") when the executable itself could
      // not be spawned, and a number for a real non-zero exit.
      const execError = error as ExecError;
      let exitCode = 1;
      if (typeof execError.code === 'number') {
        exitCode = execError.code;
      }
      return {
        agent: this.name,
        exitCode,
        stdout: this.extractResponse(execError.stdout),
        stderr: execError.stderr,
      };
    }
  }

  private extractResponse(rawStdout: string): string {
    return this.spec.extractResponse ? this.spec.extractResponse(rawStdout) : rawStdout;
  }
}
