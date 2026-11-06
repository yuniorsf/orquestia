import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { UnixSocketClient } from './unix-socket-client.js';
import type { SocketConnector } from './unix-socket-client.js';

class FakeSocket extends EventEmitter {
  readonly written: string[] = [];
  ended = false;

  write(data: string): void {
    this.written.push(data);
  }

  end(): void {
    this.ended = true;
  }
}

describe('UnixSocketClient (fake socket — fragmented reads)', () => {
  it('buffers partial chunks until a complete newline-terminated line arrives', async () => {
    const fakeSocket = new FakeSocket();
    const connect: SocketConnector = () => fakeSocket as unknown as ReturnType<SocketConnector>;
    const client = new UnixSocketClient('/unused', connect);

    const callPromise = client.call('plan.run', { taskId: 'ORQ-29' });
    fakeSocket.emit('connect');

    // First chunk has no newline yet — the client must wait, not resolve.
    fakeSocket.emit('data', Buffer.from('{"jsonrpc":"2.0","id":1,"resu'));
    await Promise.resolve();
    expect(fakeSocket.ended).toBe(false);

    fakeSocket.emit('data', Buffer.from('lt":"ok"}\n'));

    await expect(callPromise).resolves.toBe('ok');
    expect(fakeSocket.ended).toBe(true);
  });
});
