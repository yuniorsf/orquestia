import { describe, expect, it } from 'vitest';
import { PlanSynthesisService } from './plan-synthesis-service.js';
import {
  FakeConfluencePublisherPort,
  FakeJiraStatusSyncPort,
  FakePlanSpecWriterPort,
} from './test-builders.js';
import { UnverifiedPlanError, type PlanSynthesisInput, type SpecialistOutput } from './types.js';

const branchA: SpecialistOutput = {
  branch: '2A',
  fileManifest: [{ path: 'packages/core/src/foo/bar.ts', kind: 'NEW' }],
  codeSnippets: [],
};

const branchB: SpecialistOutput = {
  branch: '2B',
  fileManifest: [{ path: 'packages/core/src/foo/bar.test.ts', kind: 'NEW' }],
  codeSnippets: [],
};

function createInput(overrides: Partial<PlanSynthesisInput> = {}): PlanSynthesisInput {
  return {
    taskId: 'ORQ-14-example',
    issueKey: 'ORQ-14',
    oracleResult: { passed: true, findings: [] },
    branchA,
    branchB,
    ...overrides,
  };
}

function createService() {
  const specWriter = new FakePlanSpecWriterPort();
  const confluencePublisher = new FakeConfluencePublisherPort();
  const jiraStatusSync = new FakeJiraStatusSyncPort();
  const service = new PlanSynthesisService(specWriter, confluencePublisher, jiraStatusSync);
  return { service, specWriter, confluencePublisher, jiraStatusSync };
}

describe('PlanSynthesisService.synthesize', () => {
  it('rejects synthesizing a plan whose oracle result did not pass', async () => {
    const { service } = createService();

    await expect(
      service.synthesize(createInput({ oracleResult: { passed: false, findings: [] } })),
    ).rejects.toThrow(UnverifiedPlanError);
  });

  it('writes the spec, publishes to Confluence, and transitions the linked Jira issue', async () => {
    const { service, specWriter, confluencePublisher, jiraStatusSync } = createService();

    const specPath = await service.synthesize(createInput());

    expect(specPath).toBe('/fake/specs/plan-ORQ-14-example.md');
    expect(specWriter.writes).toHaveLength(1);
    expect(specWriter.writes[0]?.markdown).toContain('# Plan: ORQ-14-example');
    expect(specWriter.writes[0]?.markdown).toContain('- [NEW] `packages/core/src/foo/bar.ts`');
    expect(confluencePublisher.publishedPages).toEqual([
      { title: 'Plan: ORQ-14-example', markdown: specWriter.writes[0]?.markdown },
    ]);
    expect(jiraStatusSync.transitions).toEqual([
      { issueKey: 'ORQ-14', statusName: 'Ready for Dev' },
    ]);
  });

  it('skips the Jira transition when no issue key is linked', async () => {
    const { service, jiraStatusSync } = createService();

    await service.synthesize(createInput({ issueKey: null }));

    expect(jiraStatusSync.transitions).toEqual([]);
  });

  it('renders "_No files._" for an empty file manifest', async () => {
    const { service, specWriter } = createService();

    await service.synthesize(createInput({ branchA: { ...branchA, fileManifest: [] } }));

    expect(specWriter.writes[0]?.markdown).toContain('_No files._');
  });
});
