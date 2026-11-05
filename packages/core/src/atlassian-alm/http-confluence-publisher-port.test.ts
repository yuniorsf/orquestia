import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { FakeCredentialStorePort } from '../vault/test-builders.js';
import { HttpConfluencePublisherPort } from './http-confluence-publisher-port.js';
import { AlmHttpError } from './types.js';

// Each test gets its own port rather than reusing one across the file —
// rapid sequential bind/close of the same port raced with Node fetch's
// keep-alive connection pooling and produced flaky ECONNRESETs.
let nextPort = 18794;
const CLOUD_ID = 'cloud-abc';
const SPACE_KEY = 'ARCH';

interface RequestRecord {
  readonly method: string;
  readonly pathname: string;
  readonly search: URLSearchParams;
  readonly body: unknown;
}

/** A real local HTTP server standing in for the Confluence Cloud REST API v1 content endpoints' documented contract. */
function startFakeConfluenceServer(
  port: number,
  handle: (record: RequestRecord, res: ServerResponse) => void,
): Promise<Server> {
  return new Promise((resolve) => {
    const server = createServer((req: IncomingMessage, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
        const body =
          chunks.length > 0
            ? (JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown)
            : null;
        handle(
          { method: req.method ?? '', pathname: url.pathname, search: url.searchParams, body },
          res,
        );
      });
    });
    server.listen(port, () => resolve(server));
  });
}

function jsonResponse(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

describe('HttpConfluencePublisherPort.publishPage', () => {
  let server: Server;

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('creates a new page when none exists with the given title', async () => {
    const testPort = nextPort++;
    const records: RequestRecord[] = [];
    server = await startFakeConfluenceServer(testPort, (record, res) => {
      records.push(record);
      if (record.method === 'GET') {
        jsonResponse(res, 200, { results: [] });
        return;
      }
      jsonResponse(res, 200, { id: 'new-page-id' });
    });
    const credentialStore = new FakeCredentialStorePort({ atlassian_access_token: 'token-abc' });
    const port = new HttpConfluencePublisherPort(
      CLOUD_ID,
      SPACE_KEY,
      credentialStore,
      `http://127.0.0.1:${testPort}`,
    );

    await port.publishPage('Plan: ORQ-21', '# Plan\n\nSome markdown.');

    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({ method: 'GET' });
    expect(records[0]!.search.get('spaceKey')).toBe('ARCH');
    expect(records[0]!.search.get('title')).toBe('Plan: ORQ-21');
    expect(records[1]).toMatchObject({
      method: 'POST',
      body: {
        type: 'page',
        title: 'Plan: ORQ-21',
        space: { key: 'ARCH' },
        body: {
          storage: { value: '<pre># Plan\n\nSome markdown.</pre>', representation: 'storage' },
        },
      },
    });
  });

  it('updates the existing page (incrementing its version) when one is found', async () => {
    const testPort = nextPort++;
    const records: RequestRecord[] = [];
    server = await startFakeConfluenceServer(testPort, (record, res) => {
      records.push(record);
      if (record.method === 'GET') {
        jsonResponse(res, 200, { results: [{ id: 'page-123', version: { number: 4 } }] });
        return;
      }
      jsonResponse(res, 200, { id: 'page-123' });
    });
    const credentialStore = new FakeCredentialStorePort({ atlassian_access_token: 'token-abc' });
    const port = new HttpConfluencePublisherPort(
      CLOUD_ID,
      SPACE_KEY,
      credentialStore,
      `http://127.0.0.1:${testPort}`,
    );

    await port.publishPage('Plan: ORQ-21', 'updated content');

    expect(records[1]).toMatchObject({
      method: 'PUT',
      pathname: `/ex/confluence/${CLOUD_ID}/wiki/rest/api/content/page-123`,
      body: {
        id: 'page-123',
        version: { number: 5 },
        body: { storage: { value: '<pre>updated content</pre>', representation: 'storage' } },
      },
    });
  });

  it('escapes XHTML special characters in the markdown content', async () => {
    const testPort = nextPort++;
    let createdBody: unknown;
    server = await startFakeConfluenceServer(testPort, (record, res) => {
      if (record.method === 'GET') {
        jsonResponse(res, 200, { results: [] });
        return;
      }
      createdBody = record.body;
      jsonResponse(res, 200, { id: 'new-page-id' });
    });
    const credentialStore = new FakeCredentialStorePort({ atlassian_access_token: 'token-abc' });
    const port = new HttpConfluencePublisherPort(
      CLOUD_ID,
      SPACE_KEY,
      credentialStore,
      `http://127.0.0.1:${testPort}`,
    );

    await port.publishPage('Title', 'a < b && c > d');

    expect((createdBody as { body: { storage: { value: string } } }).body.storage.value).toBe(
      '<pre>a &lt; b &amp;&amp; c &gt; d</pre>',
    );
  });

  it('throws AlmHttpError when the search request fails', async () => {
    const testPort = nextPort++;
    server = await startFakeConfluenceServer(testPort, (_record, res) => {
      jsonResponse(res, 500, { message: 'internal error' });
    });
    const credentialStore = new FakeCredentialStorePort({ atlassian_access_token: 'token-abc' });
    const port = new HttpConfluencePublisherPort(
      CLOUD_ID,
      SPACE_KEY,
      credentialStore,
      `http://127.0.0.1:${testPort}`,
    );

    await expect(port.publishPage('Title', 'content')).rejects.toThrow(AlmHttpError);
  });

  it('throws AlmHttpError when the create/update request fails', async () => {
    const testPort = nextPort++;
    server = await startFakeConfluenceServer(testPort, (record, res) => {
      if (record.method === 'GET') {
        jsonResponse(res, 200, { results: [] });
        return;
      }
      jsonResponse(res, 403, { message: 'forbidden' });
    });
    const credentialStore = new FakeCredentialStorePort({ atlassian_access_token: 'token-abc' });
    const port = new HttpConfluencePublisherPort(
      CLOUD_ID,
      SPACE_KEY,
      credentialStore,
      `http://127.0.0.1:${testPort}`,
    );

    await expect(port.publishPage('Title', 'content')).rejects.toThrow(AlmHttpError);
  });

  it('throws AlmHttpError when no access token is stored', async () => {
    const testPort = nextPort++;
    server = await startFakeConfluenceServer(testPort, (_record, res) => {
      res.writeHead(500).end();
    });
    const port = new HttpConfluencePublisherPort(
      CLOUD_ID,
      SPACE_KEY,
      new FakeCredentialStorePort(),
      `http://127.0.0.1:${testPort}`,
    );

    await expect(port.publishPage('Title', 'content')).rejects.toThrow(AlmHttpError);
  });
});
