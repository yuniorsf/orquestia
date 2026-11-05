import { InvalidAlmConfigError, type AtlassianAlmConfig } from './types.js';

/**
 * Parses the `atlassian:` section of `orquestia.config.yaml` (see
 * `ORQUESTIA_SPECIFICATION.md` §2) into a typed {@link AtlassianAlmConfig}.
 * Pure — no I/O; the raw YAML document is already loaded by `ConfigReaderPort`.
 */
export function parseAtlassianAlmConfig(
  raw: Readonly<Record<string, unknown>>,
): AtlassianAlmConfig {
  const atlassian = requireMapping(raw.atlassian, 'atlassian');
  const cloudDomain = requireString(atlassian.cloud_domain, 'atlassian.cloud_domain');

  const jiraRaw = requireMapping(atlassian.jira, 'atlassian.jira');
  const projectKey = requireString(jiraRaw.project_key, 'atlassian.jira.project_key');
  const issueType = requireString(jiraRaw.issue_type, 'atlassian.jira.issue_type');
  const transitionsRaw = requireMapping(jiraRaw.transitions, 'atlassian.jira.transitions');
  const transitions: Record<string, string> = {};
  for (const [stage, statusName] of Object.entries(transitionsRaw)) {
    transitions[stage] = requireString(statusName, `atlassian.jira.transitions.${stage}`);
  }

  const confluenceRaw = requireMapping(atlassian.confluence, 'atlassian.confluence');
  const spaceKey = requireString(confluenceRaw.space_key, 'atlassian.confluence.space_key');
  const parentPageTitle = requireString(
    confluenceRaw.parent_page_title,
    'atlassian.confluence.parent_page_title',
  );

  return {
    cloudDomain,
    jira: { projectKey, issueType, transitions },
    confluence: { spaceKey, parentPageTitle },
  };
}

function requireMapping(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new InvalidAlmConfigError(`"${path}" must be a mapping.`);
  }
  return value as Record<string, unknown>;
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new InvalidAlmConfigError(`"${path}" must be a non-empty string.`);
  }
  return value;
}
