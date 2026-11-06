import type { DaemonClientPort } from '@orquestia/core';
import type { CliCommand, CommandResult } from './types.js';

const USAGE = 'Usage: orquestia queue <start|stop|status|submit|list|cancel> ...\n';

/** Starts the daemon as a detached background process — real adapter spawns `queue-daemon.ts`. */
export interface DaemonProcessLauncher {
  spawn(): Promise<void>;
}

interface QueueEntryLike {
  readonly taskId: string;
  readonly baseRef: string;
  readonly state: string;
}

interface PingResult {
  readonly pid: number;
  readonly uptimeSeconds: number;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatEntry(entry: QueueEntryLike): string {
  return `  [${entry.state}] ${entry.taskId} (${entry.baseRef})`;
}

/**
 * `orquestia queue <start|stop|status|submit|list|cancel>` — a thin IPC
 * client over the daemon's `queue.*`/`daemon.*` JSON-RPC methods (ORQ-29,
 * ORQ-11). Never executes the Coding/Planning DAG itself — `submit` only
 * enqueues a task id with the daemon; actually running it is `code`'s
 * job (ORQ-35), tracked as separate, future daemon-side wiring.
 */
export class QueueCommand implements CliCommand {
  readonly name = 'queue';
  readonly summary = 'Inspect and control the worktree task queue daemon';

  constructor(
    private readonly daemonClient: DaemonClientPort,
    private readonly launcher: DaemonProcessLauncher,
    private readonly defaultBaseRef: string,
  ) {}

  async run(args: readonly string[]): Promise<CommandResult> {
    const [action, ...rest] = args;
    switch (action) {
      case 'start':
        return this.start();
      case 'stop':
        return this.stop();
      case 'status':
        return this.status();
      case 'submit':
        return this.submit(rest);
      case 'list':
        return this.list();
      case 'cancel':
        return this.cancel(rest);
      default:
        return { exitCode: 1, stdout: '', stderr: USAGE };
    }
  }

  private async start(): Promise<CommandResult> {
    if (await this.isRunning()) {
      return { exitCode: 0, stdout: 'Orquestia daemon is already running.\n', stderr: '' };
    }
    await this.launcher.spawn();
    return { exitCode: 0, stdout: 'Orquestia daemon started.\n', stderr: '' };
  }

  private async stop(): Promise<CommandResult> {
    try {
      await this.daemonClient.call('daemon.stop');
      return { exitCode: 0, stdout: 'Orquestia daemon stopped.\n', stderr: '' };
    } catch (error) {
      return {
        exitCode: 1,
        stdout: '',
        stderr: `Failed to stop the daemon: ${errorMessage(error)}\n`,
      };
    }
  }

  private async status(): Promise<CommandResult> {
    try {
      const result = (await this.daemonClient.call('daemon.ping')) as PingResult;
      return {
        exitCode: 0,
        stdout: `Orquestia daemon is running (pid ${result.pid}, up ${Math.floor(result.uptimeSeconds)}s).\n`,
        stderr: '',
      };
    } catch {
      return { exitCode: 1, stdout: '', stderr: 'Orquestia daemon is not running.\n' };
    }
  }

  private async submit(args: readonly string[]): Promise<CommandResult> {
    const [taskId, baseRef] = args;
    if (!taskId) {
      return {
        exitCode: 1,
        stdout: '',
        stderr: 'Usage: orquestia queue submit <taskId> [baseRef]\n',
      };
    }
    try {
      const entry = (await this.daemonClient.call('queue.submit', {
        taskId,
        baseRef: baseRef ?? this.defaultBaseRef,
      })) as QueueEntryLike;
      return { exitCode: 0, stdout: `${formatEntry(entry)}\n`, stderr: '' };
    } catch (error) {
      return { exitCode: 1, stdout: '', stderr: `${errorMessage(error)}\n` };
    }
  }

  private async list(): Promise<CommandResult> {
    try {
      const result = (await this.daemonClient.call('queue.list')) as {
        running: readonly QueueEntryLike[];
        queued: readonly QueueEntryLike[];
      };
      const entries = [...result.running, ...result.queued];
      if (entries.length === 0) {
        return { exitCode: 0, stdout: 'Queue is empty.\n', stderr: '' };
      }
      return { exitCode: 0, stdout: `${entries.map(formatEntry).join('\n')}\n`, stderr: '' };
    } catch (error) {
      return { exitCode: 1, stdout: '', stderr: `${errorMessage(error)}\n` };
    }
  }

  private async cancel(args: readonly string[]): Promise<CommandResult> {
    const [taskId] = args;
    if (!taskId) {
      return { exitCode: 1, stdout: '', stderr: 'Usage: orquestia queue cancel <taskId>\n' };
    }
    try {
      const entry = (await this.daemonClient.call('queue.cancel', { taskId })) as QueueEntryLike;
      return { exitCode: 0, stdout: `${formatEntry(entry)}\n`, stderr: '' };
    } catch (error) {
      return { exitCode: 1, stdout: '', stderr: `${errorMessage(error)}\n` };
    }
  }

  private async isRunning(): Promise<boolean> {
    try {
      await this.daemonClient.call('daemon.ping');
      return true;
    } catch {
      return false;
    }
  }
}
