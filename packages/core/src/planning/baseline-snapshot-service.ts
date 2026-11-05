import type {
  ConfigReaderPort,
  GitStatusPort,
  IssueTrackerPort,
  PlanningBaseline,
} from './types.js';

/**
 * Phase 1 of the Planning DAG: grounds scope by capturing the pre-mutation
 * `baselineGitStatus` (proving zero workspace mutations for Gate 0), loading
 * `orquestia.config.yaml`, and optionally inspecting a Jira issue's details
 * without transitioning its status.
 */
export class BaselineSnapshotService {
  constructor(
    private readonly gitStatusPort: GitStatusPort,
    private readonly configReaderPort: ConfigReaderPort,
    private readonly issueTrackerPort: IssueTrackerPort,
  ) {}

  async capture(issueKey?: string): Promise<PlanningBaseline> {
    const [gitStatus, config] = await Promise.all([
      this.gitStatusPort.captureBaseline(),
      this.configReaderPort.loadConfig(),
    ]);

    const issue = issueKey ? await this.issueTrackerPort.getIssue(issueKey) : null;

    return { gitStatus, config, issue };
  }
}
