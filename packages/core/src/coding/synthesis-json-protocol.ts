import { dirname, join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import type { FileManifestEntry, SpecialistBranch } from '../planning/types.js';
import { extractJsonObject } from '../shared/json-response-extractor.js';

export class MalformedSynthesisOutputError extends Error {
  constructor(branch: SpecialistBranch, reason: string) {
    super(`Branch ${branch} synthesis returned malformed output: ${reason}`);
    this.name = 'MalformedSynthesisOutputError';
  }
}

export interface SynthesizedFile {
  readonly path: string;
  readonly content: string;
}

/** Writes a synthesized file to disk — real adapter uses `node:fs/promises`, creating parent dirs as needed. */
export interface FileWriterPort {
  write(path: string, content: string): Promise<void>;
}

export class FsFileWriter implements FileWriterPort {
  async write(path: string, content: string): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, 'utf8');
  }
}

interface RawSynthesizedFile {
  readonly path?: unknown;
  readonly content?: unknown;
}

interface RawSynthesisOutput {
  readonly files?: readonly RawSynthesizedFile[];
}

/**
 * Parses a `{"files":[{"path":...,"content":...}]}` response — the shared
 * wire format both initial synthesis and self-heal remediation prompts
 * ask the agent CLI to respond with, since neither grants the agent its
 * own file-write tool access (the dispatcher writes the files itself,
 * from plain generated text, never letting a headless/unsupervised
 * agent invocation use tools against this worktree unattended).
 */
export function parseSynthesisOutput(
  branch: SpecialistBranch,
  stdout: string,
): readonly SynthesizedFile[] {
  let parsed: RawSynthesisOutput;
  try {
    parsed = JSON.parse(extractJsonObject(stdout)) as RawSynthesisOutput;
  } catch {
    throw new MalformedSynthesisOutputError(branch, 'response was not valid JSON.');
  }

  if (!Array.isArray(parsed.files)) {
    throw new MalformedSynthesisOutputError(branch, '"files" must be an array.');
  }

  return parsed.files.map((file) => {
    if (typeof file.path !== 'string' || typeof file.content !== 'string') {
      throw new MalformedSynthesisOutputError(
        branch,
        'a files entry had an invalid "path"/"content".',
      );
    }
    return { path: file.path, content: file.content };
  });
}

export function renderFileManifestList(entries: readonly FileManifestEntry[]): string {
  return entries.map((entry) => `- [${entry.kind}] ${entry.path}`).join('\n');
}

export async function writeSynthesizedFiles(
  fileWriter: FileWriterPort,
  worktreePath: string,
  files: readonly SynthesizedFile[],
): Promise<void> {
  for (const file of files) {
    await fileWriter.write(join(worktreePath, file.path), file.content);
  }
}
