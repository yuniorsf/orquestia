import { describe, expect, it } from 'vitest';
import { HttpAgentAdapter } from './http-agent-adapter.js';
import type { AgentInvocationRequest, OpenAiCompatibleEndpoint } from './types.js';

const ENDPOINT: OpenAiCompatibleEndpoint = {
  name: 'ollama',
  baseUrl: 'http://localhost:11434/v1',
  model: 'qwen2.5-coder:7b',
};

const REQUEST: AgentInvocationRequest = {
  branch: '2A',
  cwd: '/worktrees/task-1',
  prompt: 'implement the domain model',
};

interface RecordedCall {
  readonly url: string;
  readonly init: RequestInit;
}

function fakeFetch(
  response: Response,
  calls: RecordedCall[] = [],
): { fetchFn: typeof fetch; calls: RecordedCall[] } {
  const fetchFn = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return response;
  }) as typeof fetch;
  return { fetchFn, calls };
}

describe('HttpAgentAdapter', () => {
  it('names itself after the endpoint', () => {
    const { fetchFn } = fakeFetch(new Response('{}', { status: 200 }));
    expect(new HttpAgentAdapter(ENDPOINT, fetchFn).name).toBe('ollama');
  });

  it('POSTs an OpenAI-compatible chat/completions request to <baseUrl>/chat/completions', async () => {
    const { fetchFn, calls } = fakeFetch(
      new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 }),
    );
    await new HttpAgentAdapter(ENDPOINT, fetchFn).invoke(REQUEST);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('http://localhost:11434/v1/chat/completions');
    expect(calls[0]?.init.method).toBe('POST');
    expect(JSON.parse(calls[0]?.init.body as string)).toEqual({
      model: 'qwen2.5-coder:7b',
      messages: [{ role: 'user', content: REQUEST.prompt }],
      stream: false,
    });
  });

  it('returns exitCode 0 with the message content as stdout on a successful response', async () => {
    const { fetchFn } = fakeFetch(
      new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }), {
        status: 200,
      }),
    );

    const result = await new HttpAgentAdapter(ENDPOINT, fetchFn).invoke(REQUEST);

    expect(result).toEqual({ agent: 'ollama', exitCode: 0, stdout: '{"ok":true}', stderr: '' });
  });

  it('maps a non-2xx response to a non-zero exitCode with the body as stderr', async () => {
    const { fetchFn } = fakeFetch(new Response('model not found', { status: 404 }));

    const result = await new HttpAgentAdapter(ENDPOINT, fetchFn).invoke(REQUEST);

    expect(result).toEqual({
      agent: 'ollama',
      exitCode: 404,
      stdout: '',
      stderr: 'model not found',
    });
  });

  it('maps a network failure (rejected fetch) to exitCode 1 instead of throwing', async () => {
    const fetchFn = (async () => {
      throw new Error('ECONNREFUSED');
    }) as typeof fetch;

    const result = await new HttpAgentAdapter(ENDPOINT, fetchFn).invoke(REQUEST);

    expect(result).toEqual({ agent: 'ollama', exitCode: 1, stdout: '', stderr: 'ECONNREFUSED' });
  });

  it('stringifies a non-Error rejection from fetch instead of throwing', async () => {
    const fetchFn = (() => Promise.reject('connection reset')) as typeof fetch;

    const result = await new HttpAgentAdapter(ENDPOINT, fetchFn).invoke(REQUEST);

    expect(result).toEqual({
      agent: 'ollama',
      exitCode: 1,
      stdout: '',
      stderr: 'connection reset',
    });
  });

  it('maps an unparseable response body to exitCode 1 instead of throwing', async () => {
    const { fetchFn } = fakeFetch(new Response('not json', { status: 200 }));

    const result = await new HttpAgentAdapter(ENDPOINT, fetchFn).invoke(REQUEST);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('not json');
  });

  it('maps a response with no choices[0].message.content to exitCode 1 instead of throwing', async () => {
    const { fetchFn } = fakeFetch(new Response(JSON.stringify({ choices: [] }), { status: 200 }));

    const result = await new HttpAgentAdapter(ENDPOINT, fetchFn).invoke(REQUEST);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('choices[0].message.content');
  });
});
