import type { ApprovalState, ApprovalStateStore, Clock, TokenGenerator } from '@orquestia/core';
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
