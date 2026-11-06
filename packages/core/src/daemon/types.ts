export interface JsonRpcRequest {
  readonly jsonrpc: '2.0';
  readonly id: string | number;
  readonly method: string;
  readonly params?: unknown;
}

export interface JsonRpcErrorBody {
  readonly code: number;
  readonly message: string;
}

export interface JsonRpcResponse {
  readonly jsonrpc: '2.0';
  readonly id: string | number;
  readonly result?: unknown;
  readonly error?: JsonRpcErrorBody;
}

export const JSON_RPC_METHOD_NOT_FOUND = -32601;
export const JSON_RPC_INTERNAL_ERROR = -32603;

export type RpcMethodHandler = (params: unknown) => Promise<unknown>;

/**
 * Dispatches a parsed {@link JsonRpcRequest} to a registered method
 * handler and returns the resulting {@link JsonRpcResponse}; never
 * throws — every outcome (success, unknown method, handler error) is
 * reported through the response.
 */
export interface JsonRpcDispatcherPort {
  dispatch(request: JsonRpcRequest): Promise<JsonRpcResponse>;
}

/** Thin RPC client port — `UnixSocketClient` is the real adapter; a Fake backs extension/CLI-side unit tests. */
export interface DaemonClientPort {
  call(method: string, params?: unknown): Promise<unknown>;
}

export class JsonRpcRemoteError extends Error {
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(message);
    this.name = 'JsonRpcRemoteError';
  }
}
