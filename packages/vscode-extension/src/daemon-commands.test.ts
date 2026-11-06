import type { DaemonClientPort } from '@orquestia/core';
import { describe, expect, it } from 'vitest';
import { runDaemonMethod } from './daemon-commands.js';

class FakeDaemonClientPort implements DaemonClientPort {
  readonly calls: Array<{ method: string; params: unknown }> = [];

  constructor(private readonly resultsByMethod: ReadonlyMap<string, unknown> = new Map()) {}

  async call(method: string, params?: unknown): Promise<unknown> {
    this.calls.push({ method, params });
    if (!this.resultsByMethod.has(method)) {
      throw new Error(`no result configured for method "${method}"`);
    }
    return this.resultsByMethod.get(method);
  }
}

describe('runDaemonMethod', () => {
  it('formats a completed result', async () => {
    const client = new FakeDaemonClientPort(new Map([['plan.run', { status: 'accepted' }]]));

    const message = await runDaemonMethod(client, 'plan.run', { taskId: 'ORQ-29' });

    expect(message).toBe('Orquestia: "plan.run" completed. {"status":"accepted"}');
    expect(client.calls).toEqual([{ method: 'plan.run', params: { taskId: 'ORQ-29' } }]);
  });

  it('formats a connection/remote failure instead of throwing', async () => {
    const client = new FakeDaemonClientPort();

    const message = await runDaemonMethod(client, 'code.run');

    expect(message).toContain('"code.run" failed');
    expect(message).toContain('Is the Orquestia daemon running?');
  });

  it('stringifies a non-Error throw', async () => {
    const client: DaemonClientPort = {
      call: async () => {
        throw 'raw failure';
      },
    };

    const message = await runDaemonMethod(client, 'code.run');

    expect(message).toBe(
      'Orquestia: "code.run" failed — raw failure. Is the Orquestia daemon running?',
    );
  });
});
