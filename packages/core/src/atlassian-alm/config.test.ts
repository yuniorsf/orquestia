import { describe, expect, it } from 'vitest';
import { parseAtlassianAlmConfig } from './config.js';
import { InvalidAlmConfigError } from './types.js';

const validRaw = {
  atlassian: {
    auth_mode: 'oauth2',
    cloud_domain: 'fintech.atlassian.net',
    jira: {
      project_key: 'PAY',
      issue_type: 'Story',
      transitions: {
        plan_approved: 'To Do',
        start_coding: 'In Progress',
        review_ready: 'In Review',
        completed: 'Done',
      },
    },
    confluence: {
      space_key: 'ARCH',
      parent_page_title: 'Technical Specifications',
    },
  },
};

describe('parseAtlassianAlmConfig', () => {
  it('parses the exact shape documented in ORQUESTIA_SPECIFICATION.md §2', () => {
    expect(parseAtlassianAlmConfig(validRaw)).toEqual({
      cloudDomain: 'fintech.atlassian.net',
      jira: {
        projectKey: 'PAY',
        issueType: 'Story',
        transitions: {
          plan_approved: 'To Do',
          start_coding: 'In Progress',
          review_ready: 'In Review',
          completed: 'Done',
        },
      },
      confluence: { spaceKey: 'ARCH', parentPageTitle: 'Technical Specifications' },
    });
  });

  it('throws InvalidAlmConfigError when "atlassian" is missing', () => {
    expect(() => parseAtlassianAlmConfig({})).toThrow(InvalidAlmConfigError);
  });

  it('throws InvalidAlmConfigError when "atlassian.cloud_domain" is not a string', () => {
    expect(() =>
      parseAtlassianAlmConfig({ atlassian: { ...validRaw.atlassian, cloud_domain: 42 } }),
    ).toThrow(InvalidAlmConfigError);
  });

  it('throws InvalidAlmConfigError when "atlassian.jira" is missing', () => {
    const atlassianWithoutJira = {
      auth_mode: validRaw.atlassian.auth_mode,
      cloud_domain: validRaw.atlassian.cloud_domain,
      confluence: validRaw.atlassian.confluence,
    };
    expect(() => parseAtlassianAlmConfig({ atlassian: atlassianWithoutJira })).toThrow(
      InvalidAlmConfigError,
    );
  });

  it('throws InvalidAlmConfigError when a transition value is not a string', () => {
    expect(() =>
      parseAtlassianAlmConfig({
        atlassian: {
          ...validRaw.atlassian,
          jira: { ...validRaw.atlassian.jira, transitions: { completed: 42 } },
        },
      }),
    ).toThrow(InvalidAlmConfigError);
  });

  it('throws InvalidAlmConfigError when "atlassian.confluence" is missing', () => {
    const atlassianWithoutConfluence = {
      auth_mode: validRaw.atlassian.auth_mode,
      cloud_domain: validRaw.atlassian.cloud_domain,
      jira: validRaw.atlassian.jira,
    };
    expect(() => parseAtlassianAlmConfig({ atlassian: atlassianWithoutConfluence })).toThrow(
      InvalidAlmConfigError,
    );
  });
});
