import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

/**
 * A real local HTTP server standing in for Atlassian's token endpoint,
 * returning the documented response shape — there's no disposable
 * "atlassian-dev-server" binary to spin up the way `vault server -dev`
 * exists for HashiCorp Vault, so this simulates the real contract
 * instead of hitting the actual third-party service from tests. Shared
 * between the authorization-code exchange and refresh-token tests.
 */
export function startFakeTokenServer(
  port: number,
  handle: (body: unknown, res: ServerResponse) => void,
): Promise<Server> {
  return new Promise((resolve) => {
    const server = createServer((req: IncomingMessage, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        // Every real caller (HttpTokenExchangePort, HttpTokenRefreshPort)
        // always sends a JSON body — no empty-body case to special-case.
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
        handle(body, res);
      });
    });
    server.listen(port, () => resolve(server));
  });
}
