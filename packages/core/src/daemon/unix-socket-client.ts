import { createConnection, type Socket } from 'node:net';
import type { DaemonClientPort, JsonRpcResponse } from './types.js';
import { JsonRpcRemoteError } from './types.js';

export type SocketConnector = (socketPath: string) => Socket;

/**
 * Real `DaemonClientPort` adapter: opens one Unix-domain-socket
 * connection per call, writes a single newline-delimited JSON-RPC 2.0
 * request, and resolves with the matching response's `result` (or
 * rejects with {@link JsonRpcRemoteError} for an error response, or the
 * raw socket error — e.g. `ECONNREFUSED` when no daemon is listening).
 * `connect` defaults to `net.createConnection` and is injectable so
 * tests can exercise partial/fragmented socket reads deterministically.
 */
export class UnixSocketClient implements DaemonClientPort {
  private nextRequestId = 1;

  constructor(
    private readonly socketPath: string,
    private readonly connect: SocketConnector = createConnection,
  ) {}

  async call(method: string, params?: unknown): Promise<unknown> {
    const id = this.nextRequestId++;

    return new Promise((resolve, reject) => {
      const socket = this.connect(this.socketPath);
      let buffer = '';

      socket.once('error', (error: Error) => {
        reject(error);
      });

      socket.once('connect', () => {
        socket.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
      });

      socket.on('data', (chunk: Buffer) => {
        buffer += chunk.toString('utf8');
        const newlineIndex = buffer.indexOf('\n');
        if (newlineIndex === -1) {
          return;
        }

        const line = buffer.slice(0, newlineIndex);
        socket.end();
        const response = JSON.parse(line) as JsonRpcResponse;
        if (response.error) {
          reject(new JsonRpcRemoteError(response.error.code, response.error.message));
          return;
        }
        resolve(response.result);
      });
    });
  }
}
