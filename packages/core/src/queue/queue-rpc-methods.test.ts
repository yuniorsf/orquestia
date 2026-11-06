import { describe, expect, it } from 'vitest';
import { JsonRpcDispatcher } from '../daemon/json-rpc-dispatcher.js';
import { FakeWorktreeProvisioner } from '../workspace/test-builders.js';
import { ConcurrentQueueManager } from './concurrent-queue-manager.js';
import { registerQueueRpcMethods } from './queue-rpc-methods.js';

function buildDispatcher(maxParallelTasks = 1) {
  const provisioner = new FakeWorktreeProvisioner();
  const manager = new ConcurrentQueueManager(provisioner, {
    maxParallelTasks,
    autoCleanupOnMerge: true,
  });
  const dispatcher = new JsonRpcDispatcher();
  registerQueueRpcMethods(dispatcher, manager);
  return { dispatcher, manager, provisioner };
}

describe('registerQueueRpcMethods', () => {
  it('queue.submit enqueues a task and returns its entry', async () => {
    const { dispatcher } = buildDispatcher();

    const response = await dispatcher.dispatch({
      jsonrpc: '2.0',
      id: 1,
      method: 'queue.submit',
      params: { taskId: 'ORQ-37', baseRef: 'origin/develop' },
    });

    expect(response.result).toEqual({
      taskId: 'ORQ-37',
      baseRef: 'origin/develop',
      state: 'running',
      handle: { taskId: 'ORQ-37', path: '/worktrees/ORQ-37', branch: 'orq-37' },
    });
  });

  it('queue.submit rejects a missing/non-string taskId or baseRef', async () => {
    const { dispatcher } = buildDispatcher();

    const missingTaskId = await dispatcher.dispatch({
      jsonrpc: '2.0',
      id: 1,
      method: 'queue.submit',
      params: { baseRef: 'origin/develop' },
    });
    expect(missingTaskId.error?.message).toContain('"taskId"');

    const missingBaseRef = await dispatcher.dispatch({
      jsonrpc: '2.0',
      id: 2,
      method: 'queue.submit',
      params: { taskId: 'ORQ-37' },
    });
    expect(missingBaseRef.error?.message).toContain('"baseRef"');
  });

  it('queue.list reports running and queued entries', async () => {
    const { dispatcher } = buildDispatcher(1);
    await dispatcher.dispatch({
      jsonrpc: '2.0',
      id: 1,
      method: 'queue.submit',
      params: { taskId: 'task-1', baseRef: 'origin/develop' },
    });
    await dispatcher.dispatch({
      jsonrpc: '2.0',
      id: 2,
      method: 'queue.submit',
      params: { taskId: 'task-2', baseRef: 'origin/develop' },
    });

    const response = await dispatcher.dispatch({ jsonrpc: '2.0', id: 3, method: 'queue.list' });

    expect(response.result).toMatchObject({
      running: [{ taskId: 'task-1' }],
      queued: [{ taskId: 'task-2' }],
    });
  });

  it('queue.get returns the entry for a known task', async () => {
    const { dispatcher } = buildDispatcher();
    await dispatcher.dispatch({
      jsonrpc: '2.0',
      id: 1,
      method: 'queue.submit',
      params: { taskId: 'task-1', baseRef: 'origin/develop' },
    });

    const response = await dispatcher.dispatch({
      jsonrpc: '2.0',
      id: 2,
      method: 'queue.get',
      params: { taskId: 'task-1' },
    });

    expect(response.result).toMatchObject({ taskId: 'task-1', state: 'running' });
  });

  it('queue.get errors for an unknown task', async () => {
    const { dispatcher } = buildDispatcher();

    const response = await dispatcher.dispatch({
      jsonrpc: '2.0',
      id: 1,
      method: 'queue.get',
      params: { taskId: 'missing' },
    });

    expect(response.error?.message).toContain('No queue entry for task "missing"');
  });

  it('rejects a missing taskId param across queue.get/complete/fail/cancel', async () => {
    const { dispatcher } = buildDispatcher();

    for (const method of ['queue.get', 'queue.complete', 'queue.fail', 'queue.cancel']) {
      const response = await dispatcher.dispatch({ jsonrpc: '2.0', id: 1, method, params: {} });
      expect(response.error?.message).toContain('"taskId"');
    }
  });

  it('queue.complete marks a running task completed and destroys its worktree', async () => {
    const { dispatcher, provisioner } = buildDispatcher();
    await dispatcher.dispatch({
      jsonrpc: '2.0',
      id: 1,
      method: 'queue.submit',
      params: { taskId: 'task-1', baseRef: 'origin/develop' },
    });

    const response = await dispatcher.dispatch({
      jsonrpc: '2.0',
      id: 2,
      method: 'queue.complete',
      params: { taskId: 'task-1' },
    });

    expect(response.result).toMatchObject({ state: 'completed' });
    expect(provisioner.destroyCalls).toEqual(['task-1']);
  });

  it('queue.fail marks a running task failed', async () => {
    const { dispatcher } = buildDispatcher();
    await dispatcher.dispatch({
      jsonrpc: '2.0',
      id: 1,
      method: 'queue.submit',
      params: { taskId: 'task-1', baseRef: 'origin/develop' },
    });

    const response = await dispatcher.dispatch({
      jsonrpc: '2.0',
      id: 2,
      method: 'queue.fail',
      params: { taskId: 'task-1' },
    });

    expect(response.result).toMatchObject({ state: 'failed' });
  });

  it('queue.cancel cancels a queued task', async () => {
    const { dispatcher } = buildDispatcher(1);
    await dispatcher.dispatch({
      jsonrpc: '2.0',
      id: 1,
      method: 'queue.submit',
      params: { taskId: 'task-1', baseRef: 'origin/develop' },
    });
    await dispatcher.dispatch({
      jsonrpc: '2.0',
      id: 2,
      method: 'queue.submit',
      params: { taskId: 'task-2', baseRef: 'origin/develop' },
    });

    const response = await dispatcher.dispatch({
      jsonrpc: '2.0',
      id: 3,
      method: 'queue.cancel',
      params: { taskId: 'task-2' },
    });

    expect(response.result).toMatchObject({ state: 'cancelled' });
  });

  it('daemon.ping returns the process pid and uptime', async () => {
    const { dispatcher } = buildDispatcher();

    const response = await dispatcher.dispatch({ jsonrpc: '2.0', id: 1, method: 'daemon.ping' });

    expect(response.result).toMatchObject({ pid: process.pid });
    expect((response.result as { uptimeSeconds: number }).uptimeSeconds).toBeGreaterThanOrEqual(0);
  });
});
