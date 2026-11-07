import type { AgentRouter } from '../agents/agent-router.js';
import { extractJsonObject } from '../shared/json-response-extractor.js';
import type {
  FileManifestKind,
  ManifestConflictRemediationDispatcherPort,
  SpecialistBranch,
  SpecialistDispatcherPort,
  SpecialistOutput,
} from './types.js';

export class MalformedSpecialistOutputError extends Error {
  constructor(branch: SpecialistBranch, reason: string) {
    super(`Branch ${branch} specialist returned malformed output: ${reason}`);
    this.name = 'MalformedSpecialistOutputError';
  }
}

interface RawFileManifestEntry {
  readonly path?: unknown;
  readonly kind?: unknown;
}

interface RawSpecialistOutput {
  readonly fileManifest?: readonly RawFileManifestEntry[];
  readonly codeSnippets?: readonly unknown[];
}

const VALID_KINDS: ReadonlySet<string> = new Set(['NEW', 'MODIFY']);

function branchRoleDescription(branch: SpecialistBranch): string {
  if (branch === '2A') {
    return 'pure domain architecture, business invariants, and port definitions';
  }
  return 'DTO/adapter boilerplate, test data builders, and unit tests';
}

function buildPrompt(branch: SpecialistBranch, taskId: string): string {
  return [
    `You are Branch ${branch} of the read-only Planning DAG for task "${taskId}".`,
    `Analyze the current repository and propose the ${branchRoleDescription(branch)} this task requires.`,
    'Do not write or modify any files — this is read-only analysis.',
    'Respond with ONLY a single JSON object, no markdown fences and no commentary, of this exact shape:',
    '{"fileManifest":[{"path":"<repo-relative path>","kind":"NEW"|"MODIFY"}],"codeSnippets":["<snippet>", ...]}',
  ].join('\n');
}

/** Always targets Branch 2B — matches `orquestia.config.yaml`'s own `planning_dag.gates.gate_1.remediate_with: 'branch_2b'` convention for a disjoint-ownership finding. */
function buildManifestConflictPrompt(taskId: string, overlappingPaths: readonly string[]): string {
  return [
    `You are Branch 2B of the read-only Planning DAG for task "${taskId}".`,
    `Your previous proposal included these paths, which Branch 2A has already claimed as its own — remove every one of them from your revised manifest: ${overlappingPaths.join(', ')}.`,
    `Propose a revised ${branchRoleDescription('2B')} that does not include any of those paths.`,
    'Do not write or modify any files — this is read-only analysis.',
    'Respond with ONLY a single JSON object, no markdown fences and no commentary, of this exact shape:',
    '{"fileManifest":[{"path":"<repo-relative path>","kind":"NEW"|"MODIFY"}],"codeSnippets":["<snippet>", ...]}',
  ].join('\n');
}

function parseSpecialistOutput(branch: SpecialistBranch, stdout: string): SpecialistOutput {
  let parsed: RawSpecialistOutput;
  try {
    parsed = JSON.parse(extractJsonObject(stdout)) as RawSpecialistOutput;
  } catch {
    throw new MalformedSpecialistOutputError(branch, 'response was not valid JSON.');
  }

  if (!Array.isArray(parsed.fileManifest) || !Array.isArray(parsed.codeSnippets)) {
    throw new MalformedSpecialistOutputError(
      branch,
      '"fileManifest" and "codeSnippets" must both be arrays.',
    );
  }

  const fileManifest = parsed.fileManifest.map((entry) => {
    if (
      typeof entry.path !== 'string' ||
      typeof entry.kind !== 'string' ||
      !VALID_KINDS.has(entry.kind)
    ) {
      throw new MalformedSpecialistOutputError(
        branch,
        'a fileManifest entry had an invalid "path"/"kind".',
      );
    }
    return { path: entry.path, kind: entry.kind as FileManifestKind };
  });

  const codeSnippets = parsed.codeSnippets.map((snippet) => {
    if (typeof snippet !== 'string') {
      throw new MalformedSpecialistOutputError(branch, 'a codeSnippets entry was not a string.');
    }
    return snippet;
  });

  return { branch, fileManifest, codeSnippets };
}

/**
 * Real `SpecialistDispatcherPort` adapter: routes to the configured agent
 * CLI (Claude Code / Copilot) via the existing `AgentRouter` (ORQ-24),
 * instructing it through the prompt to respond with exactly the JSON
 * shape of a {@link SpecialistOutput}.
 */
export class AgentSpecialistDispatcher
  implements SpecialistDispatcherPort, ManifestConflictRemediationDispatcherPort
{
  constructor(
    private readonly agentRouter: AgentRouter,
    private readonly cwd: string,
    private readonly taskId: string,
  ) {}

  async dispatch(branch: SpecialistBranch): Promise<SpecialistOutput> {
    const result = await this.agentRouter.dispatch(branch, {
      cwd: this.cwd,
      prompt: buildPrompt(branch, this.taskId),
    });
    return parseSpecialistOutput(branch, result.stdout);
  }

  async remediate(overlappingPaths: readonly string[]): Promise<SpecialistOutput> {
    const result = await this.agentRouter.dispatch('2B', {
      cwd: this.cwd,
      prompt: buildManifestConflictPrompt(this.taskId, overlappingPaths),
    });
    return parseSpecialistOutput('2B', result.stdout);
  }
}
