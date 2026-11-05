import type { JiraStatusSyncPort } from '../planning/types.js';
import { UnknownTransitionStageError, type AtlassianAlmConfig } from './types.js';

/**
 * "Apply the configured issue transitions per orquestia.config.yaml":
 * resolves a lifecycle-stage key (e.g. "completed") to its configured
 * Jira status name and applies it via the existing `JiraStatusSyncPort`
 * — decoupling config-driven stage naming from the Jira client itself.
 */
export class ConfiguredIssueTransitionService {
  constructor(
    private readonly config: AtlassianAlmConfig,
    private readonly jiraStatusSync: JiraStatusSyncPort,
  ) {}

  async applyTransition(issueKey: string, stage: string): Promise<void> {
    const statusName = this.config.jira.transitions[stage];
    if (!statusName) {
      throw new UnknownTransitionStageError(stage);
    }
    await this.jiraStatusSync.transitionIssue(issueKey, statusName);
  }
}
