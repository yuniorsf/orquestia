import type {
  BaselineGitStatus,
  ConfigReaderPort,
  GitStatusPort,
  IssueDetails,
  IssueTrackerPort,
  OrquestiaConfig,
} from './types.js';

export class FakeGitStatusPort implements GitStatusPort {
  constructor(private readonly status: BaselineGitStatus) {}

  async captureBaseline(): Promise<BaselineGitStatus> {
    return this.status;
  }
}

export class FakeConfigReaderPort implements ConfigReaderPort {
  constructor(private readonly config: OrquestiaConfig) {}

  async loadConfig(): Promise<OrquestiaConfig> {
    return this.config;
  }
}

export class FakeIssueTrackerPort implements IssueTrackerPort {
  readonly requestedKeys: string[] = [];

  constructor(private readonly issuesByKey: Readonly<Record<string, IssueDetails>>) {}

  async getIssue(issueKey: string): Promise<IssueDetails> {
    this.requestedKeys.push(issueKey);
    const issue = this.issuesByKey[issueKey];
    if (!issue) {
      throw new Error(`Unknown fake issue key "${issueKey}".`);
    }
    return issue;
  }
}

export const cleanGitStatus: BaselineGitStatus = {
  porcelain: '',
  headSha: 'abc1234',
  isClean: true,
};

export const sampleConfig: OrquestiaConfig = {
  version: '3.2',
  projectName: 'Orquestia',
  raw: { version: '3.2', project_name: 'Orquestia' },
};
