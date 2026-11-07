import { exec, execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import {
  WorktreeInitializationError,
  type WorktreeHandle,
  type WorktreeProvisioner,
} from './types.js';

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

const HARNESS_ENV_RELATIVE_PATH = '.harness/harness.env';
const ENV_ASSIGNMENT_PATTERN = /^([A-Z_][A-Z0-9_]*)="(.*)"$/;

/**
 * Parses `.harness/harness.env`'s simple `KEY="value"` shell-style
 * assignments — comments and blank lines are skipped; no `$VAR`
 * interpolation or multi-line values, matching every value actually
 * written to that file today (see `scripts/init-project-stack.sh`).
 */
function parseHarnessEnv(text: string): ReadonlyMap<string, string> {
  const entries = new Map<string, string>();
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith('#')) {
      continue;
    }
    const match = ENV_ASSIGNMENT_PATTERN.exec(line);
    if (match) {
      entries.set(match[1] as string, match[2] as string);
    }
  }
  return entries;
}

/**
 * Provisions the physical `../worktrees/<taskId>` sandboxes backing the
 * Workspace Engine, via plain `git worktree add|remove` (the same primitive
 * `scripts/agent-sandbox.sh` wraps for interactive/CLI use) — and, unlike
 * that script previously, also runs `.harness/harness.env`'s `INIT_CMD`
 * (e.g. `npm ci`) in the new worktree before handing it back. Without
 * this, a worktree this class provisions has no `node_modules` at all,
 * so every Coding DAG self-heal attempt at the build/lint stage fails
 * immediately on an environment problem, not a code one (see ORQ-48).
 */
export class GitWorktreeProvisioner implements WorktreeProvisioner {
  constructor(
    private readonly repoRoot: string,
    private readonly worktreesRoot: string,
  ) {}

  async create(taskId: string, baseRef: string): Promise<WorktreeHandle> {
    const branch = taskId.toLowerCase();
    const path = join(this.worktreesRoot, taskId);
    await execFileAsync('git', ['worktree', 'add', '-b', branch, path, baseRef], {
      cwd: this.repoRoot,
    });

    await this.runInitCommand(path);

    return { taskId, path, branch };
  }

  private async runInitCommand(worktreePath: string): Promise<void> {
    let harnessEnvText: string;
    try {
      harnessEnvText = await readFile(join(this.repoRoot, HARNESS_ENV_RELATIVE_PATH), 'utf8');
    } catch {
      return; // No harness.env at all for this project — nothing to initialize.
    }

    const initCommand = parseHarnessEnv(harnessEnvText).get('INIT_CMD');
    if (initCommand === undefined) {
      return;
    }

    try {
      await execAsync(initCommand, { cwd: worktreePath });
    } catch (error) {
      throw new WorktreeInitializationError(worktreePath, initCommand, error as Error);
    }
  }

  async destroy(taskId: string): Promise<void> {
    const path = join(this.worktreesRoot, taskId);
    await execFileAsync('git', ['worktree', 'remove', '--force', path], {
      cwd: this.repoRoot,
    });
  }
}
