import type { JsonRpcDispatcher } from '../daemon/json-rpc-dispatcher.js';
import type { ConcurrentQueueManager } from './concurrent-queue-manager.js';

interface SubmitParams {
  readonly taskId?: unknown;
  readonly baseRef?: unknown;
}

interface TaskIdParams {
  readonly taskId?: unknown;
}

function requireTaskId(params: unknown): string {
  const taskId = (params as TaskIdParams | undefined)?.taskId;
  if (typeof taskId !== 'string' || taskId.length === 0) {
    throw new Error('"taskId" must be a non-empty string.');
  }
  return taskId;
}

/**
 * Registers the `queue.*` and `daemon.ping` JSON-RPC methods (ORQ-29) a
 * background daemon exposes over IPC, delegating each to the given
 * `ConcurrentQueueManager` (ORQ-11). Pure wiring — no transport, no
 * process lifecycle — so it's testable by dispatching real
 * `JsonRpcRequest`s in-memory, without a real socket.
 */
export function registerQueueRpcMethods(
  dispatcher: JsonRpcDispatcher,
  manager: ConcurrentQueueManager,
): void {
  dispatcher.registerMethod('queue.submit', async (params) => {
    const { taskId, baseRef } = params as SubmitParams;
    if (typeof taskId !== 'string' || taskId.length === 0) {
      throw new Error('"taskId" must be a non-empty string.');
    }
    if (typeof baseRef !== 'string' || baseRef.length === 0) {
      throw new Error('"baseRef" must be a non-empty string.');
    }
    return manager.enqueue(taskId, baseRef);
  });

  dispatcher.registerMethod('queue.list', async () => ({
    running: manager.listRunning(),
    queued: manager.listQueued(),
  }));

  dispatcher.registerMethod('queue.get', async (params) => {
    const taskId = requireTaskId(params);
    const entry = manager.get(taskId);
    if (!entry) {
      throw new Error(`No queue entry for task "${taskId}".`);
    }
    return entry;
  });

  dispatcher.registerMethod('queue.complete', async (params) =>
    manager.complete(requireTaskId(params)),
  );
  dispatcher.registerMethod('queue.fail', async (params) => manager.fail(requireTaskId(params)));
  dispatcher.registerMethod('queue.cancel', async (params) =>
    manager.cancel(requireTaskId(params)),
  );

  dispatcher.registerMethod('daemon.ping', async () => ({
    pid: process.pid,
    uptimeSeconds: process.uptime(),
  }));
}
