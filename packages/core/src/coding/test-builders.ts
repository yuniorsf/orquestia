import type { FileManifestEntry, SpecialistBranch } from '../planning/types.js';
import type { WorktreeHandle } from '../queue/types.js';
import type {
  CheckpointHandle,
  CheckpointPort,
  CodeSynthesisDispatcherPort,
  CodeSynthesisOutput,
  CodingRemediationDispatcherPort,
  CommandResult,
  CommandRunnerPort,
  OracleStageName,
} from './types.js';

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

export class FakeCheckpointPort implements CheckpointPort {
  private sequence = 0;
  readonly createdHandles: CheckpointHandle[] = [];
  readonly rolledBackHandles: CheckpointHandle[] = [];

  async create(): Promise<CheckpointHandle> {
    this.sequence += 1;
    const handle = { id: `checkpoint-${this.sequence}` };
    this.createdHandles.push(handle);
    return handle;
  }

  async rollback(handle: CheckpointHandle): Promise<void> {
    this.rolledBackHandles.push(handle);
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
