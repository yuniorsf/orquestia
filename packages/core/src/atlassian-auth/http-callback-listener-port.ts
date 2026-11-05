import { createServer, type Server } from 'node:http';
import {
  OAuthCallbackError,
  type CallbackListenerPort,
  type OAuthCallbackResult,
} from './types.js';

const SUCCESS_HTML =
  '<html><body>Authentication complete — you can close this window.</body></html>';
const ERROR_HTML = '<html><body>Authentication failed — you can close this window.</body></html>';

/**
 * The ephemeral local listener (conventionally `http://localhost:8085/callback`)
 * that receives the single authorization redirect from Atlassian. Single-shot:
 * `awaitCallback()` resolves (or rejects) on the first matching request; the
 * caller is responsible for calling `stop()` once done with it.
 */
export class HttpCallbackListenerPort implements CallbackListenerPort {
  private server: Server | null = null;

  constructor(
    private readonly port: number,
    private readonly path: string = '/callback',
  ) {}

  async awaitCallback(): Promise<OAuthCallbackResult> {
    return new Promise((resolve, reject) => {
      const server = createServer((req, res) => {
        // req.url is always set for a request that reaches a handler —
        // Node's HTTP parser rejects a request line with no URL before
        // it gets here.
        const url = new URL(req.url!, `http://localhost:${this.port}`);
        if (url.pathname !== this.path) {
          res.writeHead(404).end();
          return;
        }

        const error = url.searchParams.get('error');
        if (error) {
          res.writeHead(200, { 'Content-Type': 'text/html' }).end(ERROR_HTML);
          reject(new OAuthCallbackError(error));
          return;
        }

        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        if (!code || !state) {
          res.writeHead(400).end();
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html' }).end(SUCCESS_HTML);
        resolve({ code, state });
      });

      this.server = server;
      server.on('error', reject);
      server.listen(this.port);
    });
  }

  async stop(): Promise<void> {
    const server = this.server;
    if (!server) {
      return;
    }
    this.server = null;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
