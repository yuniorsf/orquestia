import { describe, expect, it } from 'vitest';
import * as workspace from './index.js';

describe('workspace public API', () => {
  it('exports the Git-backed worktree provisioner, checkpoint, pool, and diff port', () => {
    expect(workspace.GitWorktreeProvisioner).toBeTypeOf('function');
    expect(workspace.GitStashCheckpoint).toBeTypeOf('function');
    expect(workspace.WorktreePool).toBeTypeOf('function');
    expect(workspace.GitWorktreeDiffPort).toBeTypeOf('function');
  });

  it('exports the worktree pool domain error types', () => {
    expect(workspace.InvalidWorktreePoolConfigError).toBeTypeOf('function');
    expect(workspace.DuplicateWorktreeSlotError).toBeTypeOf('function');
    expect(workspace.WorktreePoolExhaustedError).toBeTypeOf('function');
    expect(workspace.UnknownWorktreeSlotError).toBeTypeOf('function');
  });
});
