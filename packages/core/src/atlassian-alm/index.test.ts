import { describe, expect, it } from 'vitest';
import * as atlassianAlm from './index.js';

describe('atlassian-alm public API', () => {
  it('exports the config parser', () => {
    expect(atlassianAlm.parseAtlassianAlmConfig).toBeTypeOf('function');
  });

  it('exports the domain error types', () => {
    expect(atlassianAlm.InvalidAlmConfigError).toBeTypeOf('function');
    expect(atlassianAlm.UnknownTransitionStageError).toBeTypeOf('function');
    expect(atlassianAlm.UnknownJiraTransitionError).toBeTypeOf('function');
    expect(atlassianAlm.AlmHttpError).toBeTypeOf('function');
  });

  it('exports the orchestrating service and real adapters', () => {
    expect(atlassianAlm.ConfiguredIssueTransitionService).toBeTypeOf('function');
    expect(atlassianAlm.HttpJiraStatusSyncPort).toBeTypeOf('function');
    expect(atlassianAlm.HttpConfluencePublisherPort).toBeTypeOf('function');
  });
});
