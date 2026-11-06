import { JSON_RPC_INTERNAL_ERROR, JSON_RPC_METHOD_NOT_FOUND } from './types.js';
import type {
  JsonRpcDispatcherPort,
  JsonRpcRequest,
  JsonRpcResponse,
  RpcMethodHandler,
} from './types.js';

/**
 * Routes JSON-RPC 2.0 requests to registered method handlers
 * (`plan.run`, `code.run`, ...) by name. Transport-agnostic — the same
 * dispatcher backs both the Unix-domain-socket daemon server and any
 * future transport, since it never touches `net`/`fs` itself.
 */
export class JsonRpcDispatcher implements JsonRpcDispatcherPort {
  private readonly handlersByMethod = new Map<string, RpcMethodHandler>();

  registerMethod(method: string, handler: RpcMethodHandler): void {
    this.handlersByMethod.set(method, handler);
  }

  async dispatch(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    const handler = this.handlersByMethod.get(request.method);
    if (!handler) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: { code: JSON_RPC_METHOD_NOT_FOUND, message: `Unknown method "${request.method}".` },
      };
    }

    try {
      const result = await handler(request.params);
      return { jsonrpc: '2.0', id: request.id, result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: { code: JSON_RPC_INTERNAL_ERROR, message },
      };
    }
  }
}
