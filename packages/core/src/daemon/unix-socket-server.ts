import { rm } from 'node:fs/promises';
import { createServer, type Server, type Socket } from 'node:net';
import type { JsonRpcDispatcherPort, JsonRpcRequest } from './types.js';

/**
 * Hosts a {@link JsonRpcDispatcherPort} over a Unix domain socket (named
 * pipe on Windows — `net` abstracts the difference), framing each
 * request/response as one newline-delimited JSON document per line.
 * Removes any stale socket file at `socketPath` before listening, since
 * a prior daemon process crashing leaves one behind and `net`'s
 * `listen()` otherwise fails with `EADDRINUSE`.
 */
export class UnixSocketServer {
  private server: Server | undefined;

  constructor(
    private readonly socketPath: string,
    private readonly dispatcher: JsonRpcDispatcherPort,
  ) {}

  async start(): Promise<void> {
    await rm(this.socketPath, { force: true });

    await new Promise<void>((resolve, reject) => {
      const server = createServer((socket: Socket) => {
        this.handleConnection(socket);
      });
      server.once('error', reject);
      server.listen(this.socketPath, () => {
        server.off('error', reject);
        resolve();
      });
      this.server = server;
    });
  }

  async stop(): Promise<void> {
    const server = this.server;
    if (!server) {
      return;
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
    this.server = undefined;
  }

  private handleConnection(socket: Socket): void {
    let buffer = '';
    socket.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      let newlineIndex = buffer.indexOf('\n');
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        void this.handleLine(socket, line);
        newlineIndex = buffer.indexOf('\n');
      }
    });
  }

  private async handleLine(socket: Socket, line: string): Promise<void> {
    if (line.trim().length === 0) {
      return;
    }
    const request = JSON.parse(line) as JsonRpcRequest;
    const response = await this.dispatcher.dispatch(request);
    socket.write(`${JSON.stringify(response)}\n`);
  }
}
