import { describe, expect, it } from 'vitest';
import * as queue from './index.js';

describe('queue public API', () => {
  it('exports the manager and the Git worktree provisioner', () => {
    expect(queue.ConcurrentQueueManager).toBeTypeOf('function');
    expect(queue.GitWorktreeProvisioner).toBeTypeOf('function');
  });

  it('exports the queue domain error types', () => {
    expect(queue.DuplicateTaskError).toBeTypeOf('function');
    expect(queue.UnknownQueueEntryError).toBeTypeOf('function');
    expect(queue.InvalidQueueTransitionError).toBeTypeOf('function');
    expect(queue.InvalidQueueConfigError).toBeTypeOf('function');
  });
});
