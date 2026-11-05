import { describe, expect, it } from 'vitest';
import * as approvals from './index.js';

describe('approvals public API', () => {
  it('exports the manager and the durable JSON-file store', () => {
    expect(approvals.DurableApprovalManager).toBeTypeOf('function');
    expect(approvals.JsonFileApprovalStateStore).toBeTypeOf('function');
  });

  it('exports the approval domain error types', () => {
    expect(approvals.UnknownApprovalRecordError).toBeTypeOf('function');
    expect(approvals.InvalidApprovalTokenError).toBeTypeOf('function');
  });
});
