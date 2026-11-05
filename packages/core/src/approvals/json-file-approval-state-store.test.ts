import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { JsonFileApprovalStateStore } from './json-file-approval-state-store.js';
import type { ApprovalRecord } from './types.js';

const sampleRecord: ApprovalRecord = {
  taskId: 'task-1',
  gate: 'before_ship',
  mode: 'manual_token',
  decision: 'pending',
  requestedAt: 1_000,
  resolvedAt: null,
  token: 'token-abc',
};

describe('JsonFileApprovalStateStore', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'orquestia-approvals-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('returns an empty state when the backing file does not exist yet', async () => {
    const store = new JsonFileApprovalStateStore(join(tempDir, 'nested', 'state.json'));

    expect(await store.load()).toEqual({ records: [] });
  });

  it('persists and reloads a saved state, creating parent directories as needed', async () => {
    const filePath = join(tempDir, 'nested', 'state.json');
    const store = new JsonFileApprovalStateStore(filePath);

    await store.save({ records: [sampleRecord] });
    const reloaded = await store.load();

    expect(reloaded).toEqual({ records: [sampleRecord] });
  });

  it('overwrites a previously saved state on subsequent saves', async () => {
    const filePath = join(tempDir, 'state.json');
    const store = new JsonFileApprovalStateStore(filePath);

    await store.save({ records: [sampleRecord] });
    await store.save({ records: [] });

    expect(await store.load()).toEqual({ records: [] });
  });

  it('propagates non-ENOENT filesystem errors instead of swallowing them', async () => {
    // Pointing the store at a directory makes the read fail with EISDIR, not ENOENT.
    const store = new JsonFileApprovalStateStore(tempDir);

    await expect(store.load()).rejects.toMatchObject({ code: 'EISDIR' });
  });
});
