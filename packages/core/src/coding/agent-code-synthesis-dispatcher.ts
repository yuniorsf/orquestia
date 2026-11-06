import type { AgentRouter } from '../agents/agent-router.js';
import type { FileManifestEntry, SpecialistBranch } from '../planning/types.js';
import type { WorktreeHandle } from '../workspace/types.js';
import {
  parseSynthesisOutput,
  renderFileManifestList,
  writeSynthesizedFiles,
  type FileWriterPort,
} from './synthesis-json-protocol.js';
import type { CodeSynthesisDispatcherPort, CodeSynthesisOutput } from './types.js';

function buildSynthesisPrompt(
  branch: SpecialistBranch,
  manifest: readonly FileManifestEntry[],
): string {
  return [
    `You are Branch ${branch} of the Coding DAG. Write the full contents of exactly these files:`,
    renderFileManifestList(manifest),
    'Do not use any tools — just generate the content as text.',
    'Respond with ONLY a single JSON object, no markdown fences and no commentary, of this exact shape:',
    '{"files":[{"path":"<repo-relative path>","content":"<full file contents>"}]}',
  ].join('\n');
}

/**
 * Real `CodeSynthesisDispatcherPort` adapter: routes to the configured
 * agent CLI via the existing `AgentRouter` (ORQ-24), instructing it to
 * respond with each file's full content as JSON rather than granting it
 * tool access of its own — the dispatcher performs the actual disk
 * writes via the injected {@link FileWriterPort}, so an unsupervised
 * headless agent invocation never gets to act on this worktree directly.
 */
export class AgentCodeSynthesisDispatcher implements CodeSynthesisDispatcherPort {
  constructor(
    private readonly agentRouter: AgentRouter,
    private readonly fileWriter: FileWriterPort,
  ) {}

  async synthesize(
    branch: SpecialistBranch,
    worktree: WorktreeHandle,
    manifest: readonly FileManifestEntry[],
  ): Promise<CodeSynthesisOutput> {
    const result = await this.agentRouter.dispatch(branch, {
      cwd: worktree.path,
      prompt: buildSynthesisPrompt(branch, manifest),
    });
    const files = parseSynthesisOutput(branch, result.stdout);
    await writeSynthesizedFiles(this.fileWriter, worktree.path, files);

    return { branch, filesWritten: files.map((file) => file.path) };
  }
}
