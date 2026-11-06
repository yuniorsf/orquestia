import type {
  ApprovalState,
  ApprovalStateStore,
  BaselineGitStatus,
  Clock,
  ConfigReaderPort,
  FileExistencePort,
  GitStatusPort,
  OrquestiaConfig,
  SpecialistBranch,
  SpecialistDispatcherPort,
  SpecialistOutput,
  TokenGenerator,
} from '@orquestia/core';
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
