import type { OrquestiaConfig } from '@orquestia/core';
import { describe, expect, it } from 'vitest';
import {
  buildConfigViewModel,
  renderConfigLoadErrorHtml,
  renderOrquestiaConfigHtml,
} from './config-webview.js';

const VALID_RAW: Record<string, unknown> = {
  context_condenser: {
    engine: 'tree_sitter',
    max_context_tokens: 16000,
    include_signatures_only: true,
    prune_irrelevant_files: true,
  },
  atlassian: {
    cloud_domain: 'orquestia.atlassian.net',
    jira: {
      project_key: 'ORQ',
      issue_type: 'Story',
      transitions: { completed: 'Done' },
    },
    confluence: {
      space_key: 'ORQ',
      parent_page_title: 'Technical Specifications',
    },
  },
  layers: {
    planning_architecture: {
      enabled: false,
      strategy: 'quota_aware',
      primary_fallback: false,
      providers: [],
    },
    self_healing_retries: {
      enabled: true,
      strategy: 'least_cost',
      primary_fallback: true,
      providers: [
        { name: 'claude_code', provider: 'claude_code', base_url: 'n/a', model: 'claude' },
      ],
    },
  },
};

function makeConfig(raw: Record<string, unknown>): OrquestiaConfig {
  return { version: '3.0', projectName: 'Orquestia', raw };
}

describe('buildConfigViewModel / renderOrquestiaConfigHtml', () => {
  it('renders every section when the raw config parses cleanly', () => {
    const model = buildConfigViewModel(makeConfig(VALID_RAW));

    expect(model.condenser.ok).toBe(true);
    expect(model.atlassian.ok).toBe(true);
    expect(model.layers.ok).toBe(true);

    const html = renderOrquestiaConfigHtml(model);

    expect(html).toContain('Orquestia (v3.0)');
    expect(html).toContain('tree_sitter');
    expect(html).toContain('16000');
    expect(html).toContain('orquestia.atlassian.net');
    expect(html).toContain('ORQ');
    expect(html).toContain('planning_architecture');
    expect(html).toContain('self_healing_retries');
  });

  it('renders a per-section error message when a section fails to parse, without blanking the others', () => {
    const model = buildConfigViewModel(
      makeConfig({ context_condenser: VALID_RAW.context_condenser }),
    );

    expect(model.condenser.ok).toBe(true);
    expect(model.atlassian.ok).toBe(false);
    expect(model.layers.ok).toBe(false);

    const html = renderOrquestiaConfigHtml(model);

    expect(html).toContain('tree_sitter');
    expect(html).toContain('Invalid &quot;atlassian&quot; config section');
    expect(html).toContain('Invalid &quot;layers&quot; config section');
  });

  it('renders a per-section error message when only the condenser section fails to parse', () => {
    const rawWithoutCondenser: Record<string, unknown> = {
      atlassian: VALID_RAW.atlassian,
      layers: VALID_RAW.layers,
    };
    const model = buildConfigViewModel(makeConfig(rawWithoutCondenser));

    expect(model.condenser.ok).toBe(false);
    expect(model.atlassian.ok).toBe(true);
    expect(model.layers.ok).toBe(true);

    const html = renderOrquestiaConfigHtml(model);

    expect(html).toContain('Invalid &quot;context_condenser&quot; config section');
    expect(html).toContain('orquestia.atlassian.net');
  });

  it('escapes HTML-significant characters in the project name and parsed section values', () => {
    const raw: Record<string, unknown> = {
      ...VALID_RAW,
      atlassian: {
        ...(VALID_RAW.atlassian as Record<string, unknown>),
        cloud_domain: '<script>alert("x")</script>',
      },
    };
    const config: OrquestiaConfig = {
      version: '3.0',
      projectName: '<Orquestia>',
      raw,
    };

    const html = renderOrquestiaConfigHtml(buildConfigViewModel(config));

    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<Orquestia>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;Orquestia&gt;');
  });
});

describe('renderConfigLoadErrorHtml', () => {
  it('renders the given message', () => {
    const html = renderConfigLoadErrorHtml('ENOENT: no such file');

    expect(html).toContain('Could not load orquestia.config.yaml: ENOENT: no such file');
  });

  it('escapes HTML-significant characters in the message', () => {
    const html = renderConfigLoadErrorHtml('<script>alert("x")</script>');

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
