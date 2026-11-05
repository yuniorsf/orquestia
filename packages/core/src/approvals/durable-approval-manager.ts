import type { Clock } from '../shared/clock.js';
import type { TokenGenerator } from '../shared/token-generator.js';
import {
  InvalidApprovalTokenError,
  UnknownApprovalRecordError,
  type ApprovalDecision,
  type ApprovalGateModes,
  type ApprovalGateName,
  type ApprovalRecord,
  type ApprovalState,
  type ApprovalStateStore,
} from './types.js';

/**
 * Freezes pipeline execution at configurable gates and persists the decision
 * through an injected {@link ApprovalStateStore}, so approvals survive process
 * restarts (durable human-in-the-loop sign-off).
 */
export class DurableApprovalManager {
  constructor(
    private readonly store: ApprovalStateStore,
    private readonly clock: Clock,
    private readonly tokenGenerator: TokenGenerator,
    private readonly gateModes: ApprovalGateModes,
  ) {}

  async requestGate(taskId: string, gate: ApprovalGateName): Promise<ApprovalRecord> {
    const state = await this.store.load();
    const existing = findRecord(state, taskId, gate);
    if (existing) {
      return existing;
    }

    const mode = this.gateModes[gate];
    const requestedAt = this.clock.now();
    const autoApproved = mode === 'auto';

    const record: ApprovalRecord = {
      taskId,
      gate,
      mode,
      decision: autoApproved ? 'approved' : 'pending',
      requestedAt,
      resolvedAt: autoApproved ? requestedAt : null,
      token: mode === 'manual_token' ? this.tokenGenerator.generate() : null,
    };

    await this.store.save(appendRecord(state, record));
    return record;
  }

  async approve(taskId: string, gate: ApprovalGateName, token?: string): Promise<ApprovalRecord> {
    return this.resolve(taskId, gate, 'approved', token);
  }

  async reject(taskId: string, gate: ApprovalGateName): Promise<ApprovalRecord> {
    return this.resolve(taskId, gate, 'rejected');
  }

  async isApproved(taskId: string, gate: ApprovalGateName): Promise<boolean> {
    const state = await this.store.load();
    const record = findRecord(state, taskId, gate);
    return record?.decision === 'approved';
  }

  async listPending(taskId: string): Promise<readonly ApprovalRecord[]> {
    const state = await this.store.load();
    return state.records.filter(
      (record) => record.taskId === taskId && record.decision === 'pending',
    );
  }

  private async resolve(
    taskId: string,
    gate: ApprovalGateName,
    decision: Exclude<ApprovalDecision, 'pending'>,
    token?: string,
  ): Promise<ApprovalRecord> {
    const state = await this.store.load();
    const record = findRecord(state, taskId, gate);
    if (!record) {
      throw new UnknownApprovalRecordError(taskId, gate);
    }

    if (record.decision !== 'pending') {
      return record;
    }

    if (
      decision === 'approved' &&
      record.mode === 'manual_token' &&
      (!token || token !== record.token)
    ) {
      throw new InvalidApprovalTokenError(taskId, gate);
    }

    const resolved: ApprovalRecord = {
      ...record,
      decision,
      resolvedAt: this.clock.now(),
    };

    await this.store.save(replaceRecord(state, resolved));
    return resolved;
  }
}

function findRecord(
  state: ApprovalState,
  taskId: string,
  gate: ApprovalGateName,
): ApprovalRecord | undefined {
  return state.records.find((record) => record.taskId === taskId && record.gate === gate);
}

function appendRecord(state: ApprovalState, record: ApprovalRecord): ApprovalState {
  return { records: [...state.records, record] };
}

function replaceRecord(state: ApprovalState, record: ApprovalRecord): ApprovalState {
  return {
    records: state.records.map((existing) =>
      existing.taskId === record.taskId && existing.gate === record.gate ? record : existing,
    ),
  };
}
