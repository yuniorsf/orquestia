import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { BaselineGitStatus, GitStatusPort } from './types.js';

const execFileAsync = promisify(execFile);

/**
 * Captures `baselineGitStatus` (`git status --porcelain` + `git rev-parse
 * --short HEAD`) so the Planning DAG's Gate 0 can later prove the workspace
 * underwent zero mutations during read-only specialist dispatch.
 */
export class GitStatusSnapshotter implements GitStatusPort {
  constructor(private readonly repoRoot: string) {}

  async captureBaseline(): Promise<BaselineGitStatus> {
    const [statusResult, revParseResult] = await Promise.all([
      execFileAsync('git', ['status', '--porcelain'], { cwd: this.repoRoot }),
      execFileAsync('git', ['rev-parse', '--short', 'HEAD'], { cwd: this.repoRoot }),
    ]);

    const porcelain = statusResult.stdout;
    const headSha = revParseResult.stdout.trim();

    return { porcelain, headSha, isClean: porcelain.trim().length === 0 };
  }
}
