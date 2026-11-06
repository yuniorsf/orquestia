import {
  parseAtlassianAlmConfig,
  parseCondenserConfig,
  parseLayerPoolsConfig,
  type AtlassianAlmConfig,
  type CondenserConfig,
  type LayerConfig,
  type OrquestiaConfig,
} from '@orquestia/core';

type SectionResult<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string };

export interface ConfigViewModel {
  readonly version: string;
  readonly projectName: string;
  readonly condenser: SectionResult<CondenserConfig>;
  readonly atlassian: SectionResult<AtlassianAlmConfig>;
  readonly layers: SectionResult<readonly LayerConfig[]>;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// parseCondenserConfig/parseAtlassianAlmConfig/parseLayerPoolsConfig only
// ever throw their own Invalid*ConfigError, which extends Error — no other
// throw path exists in those pure, I/O-free parsers.
function toSectionResult<T>(parse: () => T): SectionResult<T> {
  try {
    return { ok: true, value: parse() };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

/**
 * Builds a {@link ConfigViewModel} from a loaded {@link OrquestiaConfig},
 * parsing each section independently so one invalid/absent section (e.g. an
 * unset `atlassian.cloud_domain` placeholder) doesn't blank the whole view.
 */
export function buildConfigViewModel(config: OrquestiaConfig): ConfigViewModel {
  return {
    version: config.version,
    projectName: config.projectName,
    condenser: toSectionResult(() => parseCondenserConfig(config.raw)),
    atlassian: toSectionResult(() => parseAtlassianAlmConfig(config.raw)),
    layers: toSectionResult(() => parseLayerPoolsConfig(config.raw)),
  };
}

function renderSectionError(title: string, message: string): string {
  return `<section><h2>${escapeHtml(title)}</h2><p class="error">${escapeHtml(message)}</p></section>`;
}

function renderCondenserSection(result: ConfigViewModel['condenser']): string {
  if (!result.ok) {
    return renderSectionError('Context Condenser', result.error);
  }
  const condenser = result.value;
  return `<section><h2>Context Condenser</h2><table>
    <tr><td>Engine</td><td>${escapeHtml(condenser.engine)}</td></tr>
    <tr><td>Max context tokens</td><td>${condenser.maxContextTokens}</td></tr>
    <tr><td>Signatures only</td><td>${condenser.includeSignaturesOnly}</td></tr>
    <tr><td>Prune irrelevant files</td><td>${condenser.pruneIrrelevantFiles}</td></tr>
  </table></section>`;
}

function renderAtlassianSection(result: ConfigViewModel['atlassian']): string {
  if (!result.ok) {
    return renderSectionError('Atlassian', result.error);
  }
  const atlassian = result.value;
  return `<section><h2>Atlassian</h2><table>
    <tr><td>Cloud domain</td><td>${escapeHtml(atlassian.cloudDomain)}</td></tr>
    <tr><td>Jira project</td><td>${escapeHtml(atlassian.jira.projectKey)}</td></tr>
    <tr><td>Jira issue type</td><td>${escapeHtml(atlassian.jira.issueType)}</td></tr>
    <tr><td>Confluence space</td><td>${escapeHtml(atlassian.confluence.spaceKey)}</td></tr>
  </table></section>`;
}

function renderLayerRow(layer: LayerConfig): string {
  return `<tr><td>${escapeHtml(layer.name)}</td><td>${layer.enabled}</td><td>${escapeHtml(layer.strategy)}</td><td>${layer.providers.length}</td></tr>`;
}

function renderLayersSection(result: ConfigViewModel['layers']): string {
  if (!result.ok) {
    return renderSectionError('Layers', result.error);
  }
  const rows = result.value.map(renderLayerRow).join('\n');
  return `<section><h2>Layers</h2><table><tr><th>Name</th><th>Enabled</th><th>Strategy</th><th>Providers</th></tr>${rows}</table></section>`;
}

/**
 * Renders a {@link ConfigViewModel} as a self-contained HTML document for a
 * VS Code webview panel's read-only config view. Pure and `vscode`-free so
 * it can be unit-tested without the Extension Host.
 */
export function renderOrquestiaConfigHtml(model: ConfigViewModel): string {
  return `<!DOCTYPE html><html><body>
    <h1>${escapeHtml(model.projectName)} (v${escapeHtml(model.version)})</h1>
    ${renderCondenserSection(model.condenser)}
    ${renderAtlassianSection(model.atlassian)}
    ${renderLayersSection(model.layers)}
  </body></html>`;
}

/**
 * Renders the error state when `orquestia.config.yaml` is missing or fails
 * its top-level `version`/`project_name` validation — mirrors
 * `PlanCommand.loadConfigOrDefault`'s own fallback-on-failure behavior.
 */
export function renderConfigLoadErrorHtml(message: string): string {
  return `<!DOCTYPE html><html><body><p class="empty">Could not load orquestia.config.yaml: ${escapeHtml(message)}</p></body></html>`;
}
