import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { FakeCredentialStorePort } from '../vault/test-builders.js';
import { HttpJiraStatusSyncPort } from './http-jira-status-sync-port.js';
import { AlmHttpError, UnknownJiraTransitionError } from './types.js';

// Each test gets its own port rather than reusing one across the file —
// rapid sequential bind/close of the same port raced with Node fetch's
// keep-alive connection pooling and produced flaky ECONNRESETs.
let nextPort = 18793;
const CLOUD_ID = 'cloud-abc';
const ISSUE_KEY = 'PAY-42';

/** A real local HTTP server standing in for the Jira Cloud REST API's documented transitions contract. */
function startFakeJiraServer(
  port: number,
  handle: (
    method: string,
    authHeader: string | undefined,
    body: unknown,
    res: ServerResponse,
  ) => void,
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
        handle(req.method ?? '', req.headers.authorization, body, res);
      });
    });
    server.listen(port, () => resolve(server));
  });
}

function jsonResponse(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

describe('HttpJiraStatusSyncPort.transitionIssue', () => {
  let server: Server;

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('looks up the matching transition id and posts it', async () => {
    const testPort = nextPort++;
    const calls: Array<{ method: string; auth: string | undefined; body: unknown }> = [];
    server = await startFakeJiraServer(testPort, (method, auth, body, res) => {
      calls.push({ method, auth, body });
      if (method === 'GET') {
        jsonResponse(res, 200, {
          transitions: [
            { id: '11', to: { name: 'In Progress' } },
            { id: '31', to: { name: 'Done' } },
          ],
        });
        return;
      }
      res.writeHead(204).end();
    });
    const credentialStore = new FakeCredentialStorePort({ atlassian_access_token: 'token-abc' });
    const port = new HttpJiraStatusSyncPort(
      CLOUD_ID,
      credentialStore,
      `http://127.0.0.1:${testPort}`,
    );

    await port.transitionIssue(ISSUE_KEY, 'Done');

    expect(calls).toEqual([
      { method: 'GET', auth: 'Bearer token-abc', body: null },
      { method: 'POST', auth: 'Bearer token-abc', body: { transition: { id: '31' } } },
    ]);
  });

  it('throws UnknownJiraTransitionError when no transition leads to the target status', async () => {
    const testPort = nextPort++;
    server = await startFakeJiraServer(testPort, (method, _auth, _body, res) => {
      if (method === 'GET') {
        jsonResponse(res, 200, { transitions: [{ id: '11', to: { name: 'In Progress' } }] });
        return;
      }
      res.writeHead(204).end();
    });
    const credentialStore = new FakeCredentialStorePort({ atlassian_access_token: 'token-abc' });
    const port = new HttpJiraStatusSyncPort(
      CLOUD_ID,
      credentialStore,
      `http://127.0.0.1:${testPort}`,
    );

    await expect(port.transitionIssue(ISSUE_KEY, 'Done')).rejects.toThrow(
      UnknownJiraTransitionError,
    );
  });

  it('throws AlmHttpError when listing transitions fails', async () => {
    const testPort = nextPort++;
    server = await startFakeJiraServer(testPort, (_method, _auth, _body, res) => {
      jsonResponse(res, 404, { errors: ['Issue does not exist'] });
    });
    const credentialStore = new FakeCredentialStorePort({ atlassian_access_token: 'token-abc' });
    const port = new HttpJiraStatusSyncPort(
      CLOUD_ID,
      credentialStore,
      `http://127.0.0.1:${testPort}`,
    );

    await expect(port.transitionIssue(ISSUE_KEY, 'Done')).rejects.toThrow(AlmHttpError);
  });

  it('throws AlmHttpError when applying the transition fails', async () => {
    const testPort = nextPort++;
    server = await startFakeJiraServer(testPort, (method, _auth, _body, res) => {
      if (method === 'GET') {
        jsonResponse(res, 200, { transitions: [{ id: '31', to: { name: 'Done' } }] });
        return;
      }
      jsonResponse(res, 400, { errors: ['Transition not permitted'] });
    });
    const credentialStore = new FakeCredentialStorePort({ atlassian_access_token: 'token-abc' });
    const port = new HttpJiraStatusSyncPort(
      CLOUD_ID,
      credentialStore,
      `http://127.0.0.1:${testPort}`,
    );

    await expect(port.transitionIssue(ISSUE_KEY, 'Done')).rejects.toThrow(AlmHttpError);
  });

  it('throws AlmHttpError when no access token is stored', async () => {
    const testPort = nextPort++;
    server = await startFakeJiraServer(testPort, (_method, _auth, _body, res) => {
      res.writeHead(500).end();
    });
    const port = new HttpJiraStatusSyncPort(
      CLOUD_ID,
      new FakeCredentialStorePort(),
      `http://127.0.0.1:${testPort}`,
    );

    await expect(port.transitionIssue(ISSUE_KEY, 'Done')).rejects.toThrow(AlmHttpError);
  });
});
