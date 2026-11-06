import type {
  ApprovalState,
  ApprovalStateStore,
  BaselineGitStatus,
  CheckpointHandle,
  CheckpointPort,
  Clock,
  CodeSynthesisDispatcherPort,
  CodeSynthesisOutput,
  CodingRemediationDispatcherPort,
  CommandResult as CoreCommandResult,
  CommandRunnerPort,
  ConfigReaderPort,
  FileExistencePort,
  FileManifestEntry,
  GitStatusPort,
  OracleStageName,
  OrquestiaConfig,
  ShipOutcome,
  ShipSpec,
  SpecialistBranch,
  SpecialistDispatcherPort,
  SpecialistOutput,
  TokenGenerator,
  WorktreeHandle,
  WorktreeProvisioner,
} from '@orquestia/core';
import type { CodeShipService } from './code-command.js';
import type { CliCommand, CommandResult } from './types.js';

export class FakeClock implements Clock {
  constructor(private readonly current: number = 0) {}

  now(): number {
    return this.current;
  }
}

export class FakeApprovalStateStore implements ApprovalStateStore {
  private state: ApprovalState = { records: [] };

  async load(): Promise<ApprovalState> {
    return this.state;
  }

  async save(state: ApprovalState): Promise<void> {
    this.state = state;
  }
}

export class FakeTokenGenerator implements TokenGenerator {
  private sequence = 0;

  generate(): string {
    this.sequence += 1;
    return `fake-token-${this.sequence}`;
  }
}

export class FakeGitStatusPort implements GitStatusPort {
  constructor(private status: BaselineGitStatus) {}

  async captureBaseline(): Promise<BaselineGitStatus> {
    return this.status;
  }

  setStatus(status: BaselineGitStatus): void {
    this.status = status;
  }
}

export class FakeConfigReaderPort implements ConfigReaderPort {
  constructor(private readonly configOrError: OrquestiaConfig | Error) {}

  async loadConfig(): Promise<OrquestiaConfig> {
    if (this.configOrError instanceof Error) {
      throw this.configOrError;
    }
    return this.configOrError;
  }
}

export class FakeFileExistencePort implements FileExistencePort {
  constructor(private readonly existingPaths: ReadonlySet<string> = new Set()) {}

  async exists(path: string): Promise<boolean> {
    return this.existingPaths.has(path);
  }
}

export class FakeSpecialistDispatcherPort implements SpecialistDispatcherPort {
  readonly dispatchedBranches: SpecialistBranch[] = [];

  constructor(private readonly outputs: Readonly<Record<SpecialistBranch, SpecialistOutput>>) {}

  async dispatch(branch: SpecialistBranch): Promise<SpecialistOutput> {
    this.dispatchedBranches.push(branch);
    return this.outputs[branch];
  }
}

export class FakeWorktreeProvisioner implements WorktreeProvisioner {
  readonly created: Array<{ taskId: string; baseRef: string }> = [];

  constructor(private readonly handle: (taskId: string) => WorktreeHandle) {}

  async create(taskId: string, baseRef: string): Promise<WorktreeHandle> {
    this.created.push({ taskId, baseRef });
    return this.handle(taskId);
  }

  // CodeCommand never destroys a worktree itself — cleanup is the
  // orchestration layer's job (`scripts/agent-sandbox.sh destroy`), same
  // as every other ticket shipped this session.
  async destroy(): Promise<void> {}
}

export class FakeCheckpointPort implements CheckpointPort {
  readonly rolledBackTo: CheckpointHandle[] = [];
  private sequence = 0;

  async create(): Promise<CheckpointHandle> {
    this.sequence += 1;
    return { id: `checkpoint-${this.sequence}` };
  }

  async rollback(handle: CheckpointHandle): Promise<void> {
    this.rolledBackTo.push(handle);
  }
}

export class FakeCodeSynthesisDispatcherPort implements CodeSynthesisDispatcherPort {
  readonly calls: Array<{ branch: SpecialistBranch; manifest: readonly FileManifestEntry[] }> = [];

  constructor(
    private readonly resolve: (branch: SpecialistBranch) => CodeSynthesisOutput = (branch) => ({
      branch,
      filesWritten: [],
    }),
  ) {}

  async synthesize(
    branch: SpecialistBranch,
    _worktree: WorktreeHandle,
    manifest: readonly FileManifestEntry[],
  ): Promise<CodeSynthesisOutput> {
    this.calls.push({ branch, manifest });
    return this.resolve(branch);
  }
}

export class FakeCodingRemediationDispatcherPort implements CodingRemediationDispatcherPort {
  readonly calls: Array<{ exitCode: 10 | 20 | 30; failedStage: OracleStageName }> = [];

  async remediate(exitCode: 10 | 20 | 30, failedStage: OracleStageName): Promise<void> {
    this.calls.push({ exitCode, failedStage });
  }
}

export class FakeCliCommandRunnerPort implements CommandRunnerPort {
  readonly calls: string[] = [];

  constructor(private readonly resultsByCommand: Record<string, CoreCommandResult>) {}

  async run(command: string): Promise<CoreCommandResult> {
    this.calls.push(command);
    const result = this.resultsByCommand[command];
    if (!result) {
      throw new Error(`FakeCliCommandRunnerPort: no result configured for command "${command}".`);
    }
    return result;
  }
}

export class FakeCodeShipService implements CodeShipService {
  readonly calls: Array<{ taskId: string; spec: ShipSpec }> = [];

  constructor(private readonly outcome: ShipOutcome) {}

  async ship(taskId: string, _oracleResult: unknown, spec: ShipSpec): Promise<ShipOutcome> {
    this.calls.push({ taskId, spec });
    return this.outcome;
  }
}

export class FakeCommand implements CliCommand {
  readonly calls: Array<readonly string[]> = [];

  constructor(
    readonly name: string,
    readonly summary: string,
    private readonly result: CommandResult = { exitCode: 0, stdout: '', stderr: '' },
  ) {}

  async run(args: readonly string[]): Promise<CommandResult> {
    this.calls.push(args);
    return this.result;
  }
}
