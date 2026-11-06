import type { FileManifestEntry, SpecialistBranch } from '../planning/types.js';
import type { WorktreeHandle } from '../workspace/types.js';
import type { FileWriterPort } from './synthesis-json-protocol.js';
import type {
  CodeSynthesisDispatcherPort,
  CodeSynthesisOutput,
  CodingRemediationDispatcherPort,
  CommandResult,
  CommandRunnerPort,
  OracleStageName,
} from './types.js';

export class FakeFileWriterPort implements FileWriterPort {
  readonly written: Array<{ path: string; content: string }> = [];

  async write(path: string, content: string): Promise<void> {
    this.written.push({ path, content });
  }
}

export class FakeCodeSynthesisDispatcherPort implements CodeSynthesisDispatcherPort {
  readonly calls: Array<{
    branch: SpecialistBranch;
    worktree: WorktreeHandle;
    manifest: readonly FileManifestEntry[];
  }> = [];

  constructor(
    private readonly resolve: (branch: SpecialistBranch) => CodeSynthesisOutput = (branch) => ({
      branch,
      filesWritten: [],
    }),
  ) {}

  async synthesize(
    branch: SpecialistBranch,
    worktree: WorktreeHandle,
    manifest: readonly FileManifestEntry[],
  ): Promise<CodeSynthesisOutput> {
    this.calls.push({ branch, worktree, manifest });
    return this.resolve(branch);
  }
}

export class FakeCommandRunnerPort implements CommandRunnerPort {
  readonly calls: string[] = [];
  private resultsByCommand: Record<string, CommandResult>;

  constructor(resultsByCommand: Readonly<Record<string, CommandResult>>) {
    this.resultsByCommand = { ...resultsByCommand };
  }

  async run(command: string): Promise<CommandResult> {
    this.calls.push(command);
    const result = this.resultsByCommand[command];
    if (!result) {
      throw new Error(`FakeCommandRunnerPort: no result configured for command "${command}".`);
    }
    return result;
  }

  setResult(command: string, result: CommandResult): void {
    this.resultsByCommand[command] = result;
  }
}

export class FakeCodingRemediationDispatcherPort implements CodingRemediationDispatcherPort {
  readonly calls: Array<{ exitCode: 10 | 20 | 30; failedStage: OracleStageName }> = [];

  constructor(private readonly onRemediate: (exitCode: 10 | 20 | 30) => void = () => {}) {}

  async remediate(exitCode: 10 | 20 | 30, failedStage: OracleStageName): Promise<void> {
    this.calls.push({ exitCode, failedStage });
    this.onRemediate(exitCode);
  }
}
