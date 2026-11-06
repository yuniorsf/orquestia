import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import type { ProviderEntry } from '../load-balancer/types.js';
import { HttpOpenAiCompatibleGateway } from './http-openai-compatible-gateway.js';
import { GatewayHttpError, MalformedGatewayResponseError } from './types.js';

// Each test gets its own port rather than reusing one across the file —
// rapid sequential bind/close of the same port raced with Node fetch's
// keep-alive connection pooling and produced flaky ECONNRESETs.
let nextPort = 18993;

function target(baseUrl: string): ProviderEntry {
  return { name: 'deepseek-r1', provider: 'deepseek', baseUrl, model: 'deepseek-r1' };
}

function startFakeGatewayServer(
  port: number,
  handle: (authHeader: string | undefined, body: unknown, res: ServerResponse) => void,
): Promise<Server> {
  return new Promise((resolve) => {
    const server = createServer((req: IncomingMessage, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        const body =
          chunks.length > 0
            ? (JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown)
            : null;
        handle(req.headers.authorization, body, res);
      });
    });
    server.listen(port, () => resolve(server));
  });
}

function jsonResponse(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

describe('HttpOpenAiCompatibleGateway.complete', () => {
  let server: Server;

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('posts the chat completion request and maps the first choice', async () => {
    const testPort = nextPort++;
    const calls: Array<{ auth: string | undefined; body: unknown }> = [];
    server = await startFakeGatewayServer(testPort, (auth, body, res) => {
      calls.push({ auth, body });
      jsonResponse(res, 200, {
        choices: [{ message: { content: 'hi there' }, finish_reason: 'stop' }],
      });
    });
    const gateway = new HttpOpenAiCompatibleGateway();

    const outcome = await gateway.complete(
      target(`http://127.0.0.1:${testPort}`),
      { messages: [{ role: 'user', content: 'hello' }], temperature: 0.2, maxTokens: 100 },
      'secret-key',
    );

    expect(outcome).toEqual({
      kind: 'completed',
      result: { content: 'hi there', finishReason: 'stop' },
    });
    expect(calls).toEqual([
      {
        auth: 'Bearer secret-key',
        body: {
          model: 'deepseek-r1',
          messages: [{ role: 'user', content: 'hello' }],
          temperature: 0.2,
          max_tokens: 100,
        },
      },
    ]);
  });

  it('omits the Authorization header when no apiKey is given (e.g. local Ollama/vLLM)', async () => {
    const testPort = nextPort++;
    const calls: Array<{ auth: string | undefined }> = [];
    server = await startFakeGatewayServer(testPort, (auth, _body, res) => {
      calls.push({ auth });
      jsonResponse(res, 200, { choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] });
    });
    const gateway = new HttpOpenAiCompatibleGateway();

    await gateway.complete(target(`http://127.0.0.1:${testPort}`), {
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(calls).toEqual([{ auth: undefined }]);
  });

  it('reports rate_limited with the Retry-After header value on HTTP 429', async () => {
    const testPort = nextPort++;
    server = await startFakeGatewayServer(testPort, (_auth, _body, res) => {
      res.writeHead(429, { 'Retry-After': '30' }).end();
    });
    const gateway = new HttpOpenAiCompatibleGateway();

    const outcome = await gateway.complete(target(`http://127.0.0.1:${testPort}`), {
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(outcome).toEqual({ kind: 'rate_limited', cooldownSeconds: 30 });
  });

  it('falls back to defaultCooldownSeconds on HTTP 429 without a usable Retry-After header', async () => {
    const testPort = nextPort++;
    server = await startFakeGatewayServer(testPort, (_auth, _body, res) => {
      res.writeHead(429).end();
    });
    const gateway = new HttpOpenAiCompatibleGateway(45);

    const outcome = await gateway.complete(target(`http://127.0.0.1:${testPort}`), {
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(outcome).toEqual({ kind: 'rate_limited', cooldownSeconds: 45 });
  });

  it('falls back to defaultCooldownSeconds when Retry-After is present but not numeric', async () => {
    const testPort = nextPort++;
    server = await startFakeGatewayServer(testPort, (_auth, _body, res) => {
      res.writeHead(429, { 'Retry-After': 'not-a-number' }).end();
    });
    const gateway = new HttpOpenAiCompatibleGateway(45);

    const outcome = await gateway.complete(target(`http://127.0.0.1:${testPort}`), {
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(outcome).toEqual({ kind: 'rate_limited', cooldownSeconds: 45 });
  });

  it('throws GatewayHttpError on a non-429 error response', async () => {
    const testPort = nextPort++;
    server = await startFakeGatewayServer(testPort, (_auth, _body, res) => {
      jsonResponse(res, 500, { error: 'boom' });
    });
    const gateway = new HttpOpenAiCompatibleGateway();

    await expect(
      gateway.complete(target(`http://127.0.0.1:${testPort}`), {
        messages: [{ role: 'user', content: 'hello' }],
      }),
    ).rejects.toThrow(GatewayHttpError);
  });

  it('throws MalformedGatewayResponseError when the response has no choices', async () => {
    const testPort = nextPort++;
    server = await startFakeGatewayServer(testPort, (_auth, _body, res) => {
      jsonResponse(res, 200, { choices: [] });
    });
    const gateway = new HttpOpenAiCompatibleGateway();

    await expect(
      gateway.complete(target(`http://127.0.0.1:${testPort}`), {
        messages: [{ role: 'user', content: 'hello' }],
      }),
    ).rejects.toThrow(MalformedGatewayResponseError);
  });
});
