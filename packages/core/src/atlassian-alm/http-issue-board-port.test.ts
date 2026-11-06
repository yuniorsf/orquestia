import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { FakeCredentialStorePort } from '../vault/test-builders.js';
import { HttpIssueBoardPort } from './http-issue-board-port.js';
import { AlmHttpError } from './types.js';

// Each test gets its own port rather than reusing one across the file —
// rapid sequential bind/close of the same port raced with Node fetch's
// keep-alive connection pooling and produced flaky ECONNRESETs.
let nextPort = 18893;
const CLOUD_ID = 'cloud-abc';
const PROJECT_KEY = 'ORQ';

/** A real local HTTP server standing in for the Jira Cloud REST API's documented search contract. */
function startFakeJiraServer(
  port: number,
  handle: (authHeader: string | undefined, url: string, res: ServerResponse) => void,
): Promise<Server> {
  return new Promise((resolve) => {
    const server = createServer((req: IncomingMessage, res) => {
      handle(req.headers.authorization, req.url ?? '', res);
    });
    server.listen(port, () => resolve(server));
  });
}

function jsonResponse(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

describe('HttpIssueBoardPort.listIssues', () => {
  let server: Server;

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('maps the Jira search response into BoardIssue[]', async () => {
    const testPort = nextPort++;
    const calls: Array<{ auth: string | undefined; url: string }> = [];
    server = await startFakeJiraServer(testPort, (auth, url, res) => {
      calls.push({ auth, url });
      jsonResponse(res, 200, {
        issues: [
          { key: 'ORQ-1', fields: { summary: 'First', status: { name: 'To Do' } } },
          { key: 'ORQ-2', fields: { summary: 'Second', status: { name: 'Done' } } },
        ],
      });
    });
    const credentialStore = new FakeCredentialStorePort({ atlassian_access_token: 'token-abc' });
    const port = new HttpIssueBoardPort(CLOUD_ID, credentialStore, `http://127.0.0.1:${testPort}`);

    const issues = await port.listIssues(PROJECT_KEY);

    expect(issues).toEqual([
      { key: 'ORQ-1', summary: 'First', status: 'To Do' },
      { key: 'ORQ-2', summary: 'Second', status: 'Done' },
    ]);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.auth).toBe('Bearer token-abc');
    expect(decodeURIComponent(calls[0]?.url ?? '')).toContain(`project = ${PROJECT_KEY}`);
  });

  it('throws AlmHttpError when the search request fails', async () => {
    const testPort = nextPort++;
    server = await startFakeJiraServer(testPort, (_auth, _url, res) => {
      jsonResponse(res, 500, { errors: ['Internal error'] });
    });
    const credentialStore = new FakeCredentialStorePort({ atlassian_access_token: 'token-abc' });
    const port = new HttpIssueBoardPort(CLOUD_ID, credentialStore, `http://127.0.0.1:${testPort}`);

    await expect(port.listIssues(PROJECT_KEY)).rejects.toThrow(AlmHttpError);
  });

  it('throws AlmHttpError when no access token is stored', async () => {
    const testPort = nextPort++;
    server = await startFakeJiraServer(testPort, (_auth, _url, res) => {
      res.writeHead(500).end();
    });
    const port = new HttpIssueBoardPort(
      CLOUD_ID,
      new FakeCredentialStorePort(),
      `http://127.0.0.1:${testPort}`,
    );

    await expect(port.listIssues(PROJECT_KEY)).rejects.toThrow(AlmHttpError);
  });
});
