import { describe, expect, it } from 'vitest';
import * as daemon from './index.js';

describe('daemon public API', () => {
  it('exports the dispatcher and real transport adapters', () => {
    expect(daemon.JsonRpcDispatcher).toBeTypeOf('function');
    expect(daemon.UnixSocketServer).toBeTypeOf('function');
    expect(daemon.UnixSocketClient).toBeTypeOf('function');
  });

  it('exports the domain error and protocol constants', () => {
    expect(daemon.JsonRpcRemoteError).toBeTypeOf('function');
    expect(daemon.JSON_RPC_METHOD_NOT_FOUND).toBeTypeOf('number');
    expect(daemon.JSON_RPC_INTERNAL_ERROR).toBeTypeOf('number');
  });
});
