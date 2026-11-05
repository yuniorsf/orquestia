import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { HttpTokenExchangePort } from './http-token-exchange-port.js';
import { TokenExchangeError } from './types.js';

const PORT = 18791;
const ENDPOINT = `http://127.0.0.1:${PORT}/token`;

/**
 * A real local HTTP server standing in for Atlassian's token endpoint,
 * returning the documented response shape — there's no disposable
 * "atlassian-dev-server" binary to spin up the way `vault server -dev`
 * exists for HashiCorp Vault, so this simulates the real contract
 * instead of hitting the actual third-party service from tests.
 */
function startFakeTokenServer(
  handle: (body: unknown, res: ServerResponse) => void,
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
        handle(body, res);
      });
    });
    server.listen(PORT, () => resolve(server));
  });
}

describe('HttpTokenExchangePort', () => {
  let server: Server;

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('posts the PKCE token-exchange request and parses the token response', async () => {
    let receivedBody: unknown;
    server = await startFakeTokenServer((body, res) => {
      receivedBody = body;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          access_token: 'access-abc',
          refresh_token: 'refresh-abc',
          expires_in: 3600,
          scope: 'read:jira-work write:jira-work',
        }),
      );
    });
    const port = new HttpTokenExchangePort('client-123', ENDPOINT);

    const tokens = await port.exchangeCodeForTokens(
      'auth-code-xyz',
      'code-verifier-xyz',
      'http://localhost:8085/callback',
    );

    expect(tokens).toEqual({
      accessToken: 'access-abc',
      refreshToken: 'refresh-abc',
      expiresInSeconds: 3600,
      scope: 'read:jira-work write:jira-work',
    });
    expect(receivedBody).toEqual({
      grant_type: 'authorization_code',
      client_id: 'client-123',
      code: 'auth-code-xyz',
      redirect_uri: 'http://localhost:8085/callback',
      code_verifier: 'code-verifier-xyz',
    });
  });

  it('throws TokenExchangeError when the endpoint rejects the exchange', async () => {
    server = await startFakeTokenServer((_body, res) => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'invalid_grant' }));
    });
    const port = new HttpTokenExchangePort('client-123', ENDPOINT);

    await expect(
      port.exchangeCodeForTokens(
        'expired-code',
        'code-verifier-xyz',
        'http://localhost:8085/callback',
      ),
    ).rejects.toThrow(TokenExchangeError);
  });
});
