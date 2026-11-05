export type ApprovalGateName = 'after_planning' | 'before_coding' | 'before_rebase' | 'before_ship';

export type ApprovalMode = 'auto' | 'prompt' | 'manual_token';

export type ApprovalDecision = 'pending' | 'approved' | 'rejected';

export interface ApprovalRecord {
  readonly taskId: string;
  readonly gate: ApprovalGateName;
  readonly mode: ApprovalMode;
  readonly decision: ApprovalDecision;
  readonly requestedAt: number;
  readonly resolvedAt: number | null;
  readonly token: string | null;
}

export interface ApprovalState {
  readonly records: readonly ApprovalRecord[];
}

export interface ApprovalStateReader {
  load(): Promise<ApprovalState>;
}

export interface ApprovalStateWriter {
  save(state: ApprovalState): Promise<void>;
}

export interface ApprovalStateStore extends ApprovalStateReader, ApprovalStateWriter {}

export type ApprovalGateModes = Readonly<Record<ApprovalGateName, ApprovalMode>>;

export class UnknownApprovalRecordError extends Error {
  constructor(taskId: string, gate: ApprovalGateName) {
    super(`No approval record for task "${taskId}" at gate "${gate}". Call requestGate() first.`);
    this.name = 'UnknownApprovalRecordError';
  }
}

export class InvalidApprovalTokenError extends Error {
  constructor(taskId: string, gate: ApprovalGateName) {
    super(`Invalid or missing manual approval token for task "${taskId}" at gate "${gate}".`);
    this.name = 'InvalidApprovalTokenError';
  }
}
