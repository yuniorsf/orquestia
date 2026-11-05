import { describe, expect, it } from 'vitest';
import { FakeJiraStatusSyncPort } from '../planning/test-builders.js';
import { ConfiguredIssueTransitionService } from './configured-issue-transition-service.js';
import type { AtlassianAlmConfig } from './types.js';
import { UnknownTransitionStageError } from './types.js';

const config: AtlassianAlmConfig = {
  cloudDomain: 'fintech.atlassian.net',
  jira: {
    projectKey: 'PAY',
    issueType: 'Story',
    transitions: { completed: 'Done', review_ready: 'In Review' },
  },
  confluence: { spaceKey: 'ARCH', parentPageTitle: 'Technical Specifications' },
};

describe('ConfiguredIssueTransitionService.applyTransition', () => {
  it('resolves the configured stage to a Jira status name and applies it', async () => {
    const jiraStatusSync = new FakeJiraStatusSyncPort();
    const service = new ConfiguredIssueTransitionService(config, jiraStatusSync);

    await service.applyTransition('PAY-42', 'completed');

    expect(jiraStatusSync.transitions).toEqual([{ issueKey: 'PAY-42', statusName: 'Done' }]);
  });

  it('throws UnknownTransitionStageError for a stage not present in config', async () => {
    const service = new ConfiguredIssueTransitionService(config, new FakeJiraStatusSyncPort());

    await expect(service.applyTransition('PAY-42', 'not_a_configured_stage')).rejects.toThrow(
      UnknownTransitionStageError,
    );
  });
});
