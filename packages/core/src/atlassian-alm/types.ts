/**
 * ALM Sync: drives the real Confluence/Jira clients (publishing
 * architecture pages, applying the issue transitions configured in
 * `orquestia.config.yaml`'s `atlassian:` section) behind the existing
 * `ConfluencePublisherPort`/`JiraStatusSyncPort` ports from `planning/`.
 */
export interface JiraAlmConfig {
  readonly projectKey: string;
  readonly issueType: string;
  /** Lifecycle-stage key (e.g. "completed") -> Jira status name (e.g. "Done"). */
  readonly transitions: Readonly<Record<string, string>>;
}

export interface ConfluenceAlmConfig {
  readonly spaceKey: string;
  readonly parentPageTitle: string;
}

export interface AtlassianAlmConfig {
  readonly cloudDomain: string;
  readonly jira: JiraAlmConfig;
  readonly confluence: ConfluenceAlmConfig;
}

export class InvalidAlmConfigError extends Error {
  constructor(message: string) {
    super(`Invalid "atlassian" config section in orquestia.config.yaml: ${message}`);
    this.name = 'InvalidAlmConfigError';
  }
}

export class UnknownTransitionStageError extends Error {
  constructor(stage: string) {
    super(
      `No Jira status is configured for lifecycle stage "${stage}" under atlassian.jira.transitions.`,
    );
    this.name = 'UnknownTransitionStageError';
  }
}

export class UnknownJiraTransitionError extends Error {
  constructor(issueKey: string, statusName: string) {
    super(`Issue ${issueKey} has no available transition to status "${statusName}".`);
    this.name = 'UnknownJiraTransitionError';
  }
}

export class AlmHttpError extends Error {
  constructor(status: number, body: string) {
    super(`Atlassian ALM request failed (HTTP ${status}): ${body}`);
    this.name = 'AlmHttpError';
  }
}
