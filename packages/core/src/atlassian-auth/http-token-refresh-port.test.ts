import type { Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { HttpTokenRefreshPort } from './http-token-refresh-port.js';
import { startFakeTokenServer } from './test-token-server.js';
import { TokenExchangeError } from './types.js';

const PORT = 18792;
const ENDPOINT = `http://127.0.0.1:${PORT}/token`;

describe('HttpTokenRefreshPort', () => {
  let server: Server;

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('posts the refresh_token grant and parses the renewed token response', async () => {
    let receivedBody: unknown;
    server = await startFakeTokenServer(PORT, (body, res) => {
      receivedBody = body;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          access_token: 'access-renewed',
          refresh_token: 'refresh-renewed',
          expires_in: 3600,
          scope: 'read:jira-work write:jira-work',
        }),
      );
    });
    const port = new HttpTokenRefreshPort('client-123', ENDPOINT);

    const tokens = await port.refresh('refresh-old');

    expect(tokens).toEqual({
      accessToken: 'access-renewed',
      refreshToken: 'refresh-renewed',
      expiresInSeconds: 3600,
      scope: 'read:jira-work write:jira-work',
    });
    expect(receivedBody).toEqual({
      grant_type: 'refresh_token',
      client_id: 'client-123',
      refresh_token: 'refresh-old',
    });
  });

  it('throws TokenExchangeError when the endpoint rejects the refresh', async () => {
    server = await startFakeTokenServer(PORT, (_body, res) => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'invalid_grant' }));
    });
    const port = new HttpTokenRefreshPort('client-123', ENDPOINT);

    await expect(port.refresh('revoked-refresh-token')).rejects.toThrow(TokenExchangeError);
  });
});
