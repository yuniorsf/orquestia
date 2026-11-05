export interface BaselineGitStatus {
  readonly porcelain: string;
  readonly headSha: string;
  readonly isClean: boolean;
}

export interface GitStatusPort {
  captureBaseline(): Promise<BaselineGitStatus>;
}

export interface OrquestiaConfig {
  readonly version: string;
  readonly projectName: string;
  readonly raw: Readonly<Record<string, unknown>>;
}

export interface ConfigReaderPort {
  loadConfig(): Promise<OrquestiaConfig>;
}

export interface IssueDetails {
  readonly key: string;
  readonly summary: string;
  readonly status: string;
  readonly blockedByKeys: readonly string[];
}

export interface IssueTrackerPort {
  getIssue(issueKey: string): Promise<IssueDetails>;
}

export interface PlanningBaseline {
  readonly gitStatus: BaselineGitStatus;
  readonly config: OrquestiaConfig;
  readonly issue: IssueDetails | null;
}

export class ConfigValidationError extends Error {
  constructor(filePath: string, reason: string) {
    super(`Invalid orquestia config at "${filePath}": ${reason}`);
    this.name = 'ConfigValidationError';
  }
}
