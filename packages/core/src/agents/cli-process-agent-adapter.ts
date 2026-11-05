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
  readonly code?: number | string | null;
  readonly stdout?: string;
  readonly stderr?: string;
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
      return { agent: this.name, exitCode: 0, stdout, stderr };
    } catch (error) {
      // node:child_process rejects with an Error carrying code/stdout/stderr.
      // `code` is a string (e.g. "ENOENT") when the executable itself could
      // not be spawned, and stdout/stderr are left undefined in that case
      // since the process never started; both fall back to safe defaults.
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
      return { agent: this.name, exitCode, stdout, stderr };
    }
  }
}
