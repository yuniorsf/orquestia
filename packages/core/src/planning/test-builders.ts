import type {
  BaselineGitStatus,
  ConfigReaderPort,
  ConfluencePublisherPort,
  FileExistencePort,
  GateFinding,
  GitStatusPort,
  IssueDetails,
  IssueTrackerPort,
  JiraStatusSyncPort,
  OrquestiaConfig,
  PlanSpecWriterPort,
  RemediationDispatcherPort,
  SpecialistBranch,
  SpecialistDispatcherPort,
  SpecialistOutput,
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

export class FakeSpecialistDispatcherPort implements SpecialistDispatcherPort {
  readonly dispatchedBranches: SpecialistBranch[] = [];

  constructor(private readonly outputs: Readonly<Record<SpecialistBranch, SpecialistOutput>>) {}

  async dispatch(branch: SpecialistBranch): Promise<SpecialistOutput> {
    this.dispatchedBranches.push(branch);
    return this.outputs[branch];
  }
}

export class InMemoryFileExistencePort implements FileExistencePort {
  constructor(private readonly existingPaths: ReadonlySet<string>) {}

  async exists(path: string): Promise<boolean> {
    return this.existingPaths.has(path);
  }
}

export class FakeRemediationDispatcherPort implements RemediationDispatcherPort {
  readonly calls: Array<{ branch: SpecialistBranch; findings: readonly GateFinding[] }> = [];

  constructor(
    private readonly resolve: (
      branch: SpecialistBranch,
      findings: readonly GateFinding[],
    ) => SpecialistOutput,
  ) {}

  async remediate(
    branch: SpecialistBranch,
    findings: readonly GateFinding[],
  ): Promise<SpecialistOutput> {
    this.calls.push({ branch, findings });
    return this.resolve(branch, findings);
  }
}

export class FakePlanSpecWriterPort implements PlanSpecWriterPort {
  readonly writes: Array<{ taskId: string; markdown: string }> = [];

  async writeSpec(taskId: string, markdown: string): Promise<string> {
    this.writes.push({ taskId, markdown });
    return `/fake/specs/plan-${taskId}.md`;
  }
}

export class FakeConfluencePublisherPort implements ConfluencePublisherPort {
  readonly publishedPages: Array<{ title: string; markdown: string }> = [];

  async publishPage(title: string, markdown: string): Promise<void> {
    this.publishedPages.push({ title, markdown });
  }
}

export class FakeJiraStatusSyncPort implements JiraStatusSyncPort {
  readonly transitions: Array<{ issueKey: string; statusName: string }> = [];

  async transitionIssue(issueKey: string, statusName: string): Promise<void> {
    this.transitions.push({ issueKey, statusName });
  }
}
