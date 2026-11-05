import type { Clock } from '../shared/clock.js';
import type { TokenGenerator } from '../shared/token-generator.js';
import type { ApprovalGateModes, ApprovalState, ApprovalStateStore } from './types.js';

export class FakeClock implements Clock {
  constructor(private current: number = 0) {}

  now(): number {
    return this.current;
  }

  advanceTo(timestamp: number): void {
    this.current = timestamp;
  }
}

export class FakeTokenGenerator implements TokenGenerator {
  private sequence = 0;

  generate(): string {
    this.sequence += 1;
    return `fake-token-${this.sequence}`;
  }
}

export class InMemoryApprovalStateStore implements ApprovalStateStore {
  private state: ApprovalState;

  constructor(initial: ApprovalState = { records: [] }) {
    this.state = initial;
  }

  async load(): Promise<ApprovalState> {
    return this.state;
  }

  async save(state: ApprovalState): Promise<void> {
    this.state = state;
  }
}

export const defaultGateModes: ApprovalGateModes = {
  after_planning: 'auto',
  before_coding: 'prompt',
  before_rebase: 'auto',
  before_ship: 'manual_token',
};
