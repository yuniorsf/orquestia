import { describe, expect, it } from 'vitest';
import { JsonRpcDispatcher } from './json-rpc-dispatcher.js';
import { JSON_RPC_INTERNAL_ERROR, JSON_RPC_METHOD_NOT_FOUND } from './types.js';

describe('JsonRpcDispatcher', () => {
  it('dispatches to the registered handler and returns its result', async () => {
    const dispatcher = new JsonRpcDispatcher();
    dispatcher.registerMethod('plan.run', async (params) => ({ echoed: params }));

    const response = await dispatcher.dispatch({
      jsonrpc: '2.0',
      id: 1,
      method: 'plan.run',
      params: { taskId: 'ORQ-1' },
    });

    expect(response).toEqual({
      jsonrpc: '2.0',
      id: 1,
      result: { echoed: { taskId: 'ORQ-1' } },
    });
  });

  it('returns a method-not-found error for an unregistered method', async () => {
    const dispatcher = new JsonRpcDispatcher();

    const response = await dispatcher.dispatch({ jsonrpc: '2.0', id: 'x', method: 'missing' });

    expect(response).toEqual({
      jsonrpc: '2.0',
      id: 'x',
      error: { code: JSON_RPC_METHOD_NOT_FOUND, message: 'Unknown method "missing".' },
    });
  });

  it('catches a handler throwing and reports an internal error', async () => {
    const dispatcher = new JsonRpcDispatcher();
    dispatcher.registerMethod('code.run', async () => {
      throw new Error('boom');
    });

    const response = await dispatcher.dispatch({ jsonrpc: '2.0', id: 2, method: 'code.run' });

    expect(response).toEqual({
      jsonrpc: '2.0',
      id: 2,
      error: { code: JSON_RPC_INTERNAL_ERROR, message: 'boom' },
    });
  });

  it('wraps a non-Error throw as a string message', async () => {
    const dispatcher = new JsonRpcDispatcher();
    dispatcher.registerMethod('code.run', async () => {
      throw 'raw string failure';
    });

    const response = await dispatcher.dispatch({ jsonrpc: '2.0', id: 3, method: 'code.run' });

    expect(response.error).toEqual({
      code: JSON_RPC_INTERNAL_ERROR,
      message: 'raw string failure',
    });
  });
});
