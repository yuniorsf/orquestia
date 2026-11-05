import {
  UnverifiedPlanError,
  type ConfluencePublisherPort,
  type FileManifestEntry,
  type JiraStatusSyncPort,
  type PlanSpecWriterPort,
  type PlanSynthesisInput,
} from './types.js';

const READY_FOR_DEV_STATUS = 'Ready for Dev';

/**
 * Phase 5 of the Planning DAG: synthesizes the verified plan into Markdown,
 * writes it to `.orquestia/specs/plan-<taskId>.md`, publishes it to
 * Confluence, and transitions the Jira issue (when one is linked) to
 * "Ready for Dev".
 */
export class PlanSynthesisService {
  constructor(
    private readonly specWriter: PlanSpecWriterPort,
    private readonly confluencePublisher: ConfluencePublisherPort,
    private readonly jiraStatusSync: JiraStatusSyncPort,
  ) {}

  async synthesize(input: PlanSynthesisInput): Promise<string> {
    if (!input.oracleResult.passed) {
      throw new UnverifiedPlanError(input.taskId);
    }

    const markdown = renderPlanMarkdown(input);
    const specPath = await this.specWriter.writeSpec(input.taskId, markdown);
    await this.confluencePublisher.publishPage(`Plan: ${input.taskId}`, markdown);

    if (input.issueKey) {
      await this.jiraStatusSync.transitionIssue(input.issueKey, READY_FOR_DEV_STATUS);
    }

    return specPath;
  }
}

function renderPlanMarkdown(input: PlanSynthesisInput): string {
  const lines: string[] = [
    `# Plan: ${input.taskId}`,
    '',
    '**Status**: Verified (Deterministic Plan Oracle passed, 0 findings)',
    '',
    '## Branch 2A — Architecture & Domain File Manifest',
    ...formatManifest(input.branchA.fileManifest),
    '',
    '## Branch 2B — Contracts & Test File Manifest',
    ...formatManifest(input.branchB.fileManifest),
  ];
  return `${lines.join('\n')}\n`;
}

function formatManifest(entries: readonly FileManifestEntry[]): string[] {
  if (entries.length === 0) {
    return ['_No files._'];
  }
  return entries.map((entry) => `- [${entry.kind}] \`${entry.path}\``);
}
