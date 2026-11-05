import { describe, expect, it } from 'vitest';
import { BaselineSnapshotService } from './baseline-snapshot-service.js';
import {
  FakeConfigReaderPort,
  FakeGitStatusPort,
  FakeIssueTrackerPort,
  cleanGitStatus,
  sampleConfig,
} from './test-builders.js';

const sampleIssue = {
  key: 'ORQ-12',
  summary: 'Planning DAG — Baseline Snapshot & Scope Grounding',
  status: 'In Progress',
  blockedByKeys: [],
};

function createService(issuesByKey: Record<string, typeof sampleIssue> = {}) {
  const gitStatusPort = new FakeGitStatusPort(cleanGitStatus);
  const configReaderPort = new FakeConfigReaderPort(sampleConfig);
  const issueTrackerPort = new FakeIssueTrackerPort(issuesByKey);
  const service = new BaselineSnapshotService(gitStatusPort, configReaderPort, issueTrackerPort);
  return { service, issueTrackerPort };
}

describe('BaselineSnapshotService.capture', () => {
  it('captures git status and config without inspecting any issue when no key is given', async () => {
    const { service, issueTrackerPort } = createService();

    const baseline = await service.capture();

    expect(baseline.gitStatus).toEqual(cleanGitStatus);
    expect(baseline.config).toEqual(sampleConfig);
    expect(baseline.issue).toBeNull();
    expect(issueTrackerPort.requestedKeys).toEqual([]);
  });

  it('grounds against the given Jira issue when a key is provided', async () => {
    const { service, issueTrackerPort } = createService({ 'ORQ-12': sampleIssue });

    const baseline = await service.capture('ORQ-12');

    expect(baseline.issue).toEqual(sampleIssue);
    expect(issueTrackerPort.requestedKeys).toEqual(['ORQ-12']);
  });

  it('propagates issue tracker errors for an unknown key', async () => {
    const { service } = createService();

    await expect(service.capture('UNKNOWN-1')).rejects.toThrow('Unknown fake issue key');
  });
});
