import { spawn } from 'node:child_process';
import { mkdir, open } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { DaemonProcessLauncher } from './queue-command.js';

/**
 * Real `DaemonProcessLauncher` adapter: spawns `node <scriptPath> ...args`
 * fully detached (its own process group, `unref()`'d so the parent CLI
 * invocation can exit immediately), with stdout/stderr redirected to a
 * log file rather than inherited — once the parent process exits there
 * is no terminal left to write to.
 */
export class ChildProcessDaemonLauncher implements DaemonProcessLauncher {
  constructor(
    private readonly scriptPath: string,
    private readonly scriptArgs: readonly string[],
    private readonly cwd: string,
    private readonly logPath: string,
  ) {}

  async spawn(): Promise<void> {
    await mkdir(dirname(this.logPath), { recursive: true });
    const log = await open(this.logPath, 'a');

    const child = spawn(process.execPath, [this.scriptPath, ...this.scriptArgs], {
      detached: true,
      stdio: ['ignore', log.fd, log.fd],
      cwd: this.cwd,
    });
    child.unref();

    await log.close();
  }
}
