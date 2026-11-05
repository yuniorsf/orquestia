import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { ApprovalState, ApprovalStateStore } from './types.js';

const EMPTY_STATE: ApprovalState = { records: [] };

/**
 * Persists {@link ApprovalState} as JSON on disk (the `.orquestia/state.json`
 * non-volatile storage referenced by the Durable Approval Manager spec).
 */
export class JsonFileApprovalStateStore implements ApprovalStateStore {
  constructor(private readonly filePath: string) {}

  async load(): Promise<ApprovalState> {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      return JSON.parse(raw) as ApprovalState;
    } catch (error) {
      if (isFileNotFoundError(error)) {
        return EMPTY_STATE;
      }
      throw error;
    }
  }

  async save(state: ApprovalState): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(state, null, 2), 'utf8');
  }
}

function isFileNotFoundError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}
