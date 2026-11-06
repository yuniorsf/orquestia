import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createConnection } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { JsonRpcDispatcher } from './json-rpc-dispatcher.js';
import { JsonRpcRemoteError } from './types.js';
import { UnixSocketClient } from './unix-socket-client.js';
import { UnixSocketServer } from './unix-socket-server.js';

describe('UnixSocketServer + UnixSocketClient (real IPC over a Unix domain socket)', () => {
  let dir: string;
  let socketPath: string;
  let server: UnixSocketServer;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'orquestia-daemon-'));
    socketPath = join(dir, 'daemon.sock');
  });

  afterEach(async () => {
    await server.stop();
    await rm(dir, { recursive: true, force: true });
  });

  it('round-trips a real request/response over the socket', async () => {
    const dispatcher = new JsonRpcDispatcher();
    dispatcher.registerMethod('plan.run', async (params) => ({ status: 'accepted', params }));
    server = new UnixSocketServer(socketPath, dispatcher);
    await server.start();

    const client = new UnixSocketClient(socketPath);
    const result = await client.call('plan.run', { taskId: 'ORQ-29' });

    expect(result).toEqual({ status: 'accepted', params: { taskId: 'ORQ-29' } });
  });

  it('rejects with JsonRpcRemoteError when the remote method is unknown', async () => {
    const dispatcher = new JsonRpcDispatcher();
    server = new UnixSocketServer(socketPath, dispatcher);
    await server.start();

    const client = new UnixSocketClient(socketPath);

    await expect(client.call('nonexistent.method')).rejects.toThrow(JsonRpcRemoteError);
  });

  it('rejects when no daemon is listening on the socket path', async () => {
    server = new UnixSocketServer(socketPath, new JsonRpcDispatcher());
    // Deliberately never started — socketPath has no listener.

    const client = new UnixSocketClient(socketPath);

    await expect(client.call('plan.run')).rejects.toThrow();
  });

  it('removes a stale socket file left by a crashed prior daemon before listening again', async () => {
    // Simulate a crash: a plain file sits at socketPath with no listener
    // behind it (a clean `stop()` would have removed it via `close()`).
    await writeFile(socketPath, 'stale');

    const dispatcher = new JsonRpcDispatcher();
    dispatcher.registerMethod('ping', async () => 'pong');
    server = new UnixSocketServer(socketPath, dispatcher);
    await server.start();

    const client = new UnixSocketClient(socketPath);
    await expect(client.call('ping')).resolves.toBe('pong');
  });

  it('ignores a blank line sent on the wire before a real request', async () => {
    const dispatcher = new JsonRpcDispatcher();
    dispatcher.registerMethod('ping', async () => 'pong');
    server = new UnixSocketServer(socketPath, dispatcher);
    await server.start();

    const response = await new Promise<string>((resolve, reject) => {
      const socket = createConnection(socketPath);
      let buffer = '';
      socket.once('error', reject);
      socket.once('connect', () => {
        socket.write('\n{"jsonrpc":"2.0","id":1,"method":"ping"}\n');
      });
      socket.on('data', (chunk: Buffer) => {
        buffer += chunk.toString('utf8');
        const newlineIndex = buffer.indexOf('\n');
        if (newlineIndex === -1) {
          return;
        }
        socket.end();
        resolve(buffer.slice(0, newlineIndex));
      });
    });

    expect(JSON.parse(response)).toEqual({ jsonrpc: '2.0', id: 1, result: 'pong' });
  });

  it('handles multiple requests sent back-to-back on the same server', async () => {
    const dispatcher = new JsonRpcDispatcher();
    let callCount = 0;
    dispatcher.registerMethod('count', async () => {
      callCount += 1;
      return callCount;
    });
    server = new UnixSocketServer(socketPath, dispatcher);
    await server.start();

    const client = new UnixSocketClient(socketPath);
    const results = [await client.call('count'), await client.call('count')];

    expect(results).toEqual([1, 2]);
  });
});
