import { afterEach, describe, expect, it } from 'vitest';
import { HttpCallbackListenerPort } from './http-callback-listener-port.js';
import { OAuthCallbackError } from './types.js';

const PORT = 18790;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function waitUntilListening(path = '/callback'): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      // A request with no code/state gets a real 400 from the running
      // server — that's our readiness signal, and it doesn't resolve
      // the listener's awaitCallback() promise.
      const response = await fetch(`${BASE_URL}${path}`);
      if (response.status === 400) {
        return;
      }
    } catch {
      // Socket not open yet — keep polling.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Callback listener did not start in time.');
}

describe('HttpCallbackListenerPort', () => {
  let listener: HttpCallbackListenerPort;

  afterEach(async () => {
    await listener.stop();
  });

  it('resolves with the code and state from a valid callback request', async () => {
    listener = new HttpCallbackListenerPort(PORT);
    const callbackPromise = listener.awaitCallback();
    await waitUntilListening();

    await fetch(`${BASE_URL}/callback?code=auth-code-123&state=state-abc`);

    await expect(callbackPromise).resolves.toEqual({ code: 'auth-code-123', state: 'state-abc' });
  });

  it('rejects with OAuthCallbackError when the redirect carries an error param', async () => {
    listener = new HttpCallbackListenerPort(PORT);
    const callbackPromise = listener.awaitCallback();
    await waitUntilListening();

    // Attach the rejection assertion before triggering the request that
    // causes the rejection — otherwise the promise can reject in the
    // window between the request completing and this line running,
    // which Node reports as an unhandled rejection.
    const assertion = expect(callbackPromise).rejects.toThrow(OAuthCallbackError);
    await fetch(`${BASE_URL}/callback?error=access_denied&state=state-abc`);
    await assertion;
  });

  it('responds 404 to a request on an unrelated path without resolving the callback', async () => {
    listener = new HttpCallbackListenerPort(PORT);
    const callbackPromise = listener.awaitCallback();
    await waitUntilListening();

    const response = await fetch(`${BASE_URL}/unrelated-path`);
    expect(response.status).toBe(404);

    await fetch(`${BASE_URL}/callback?code=auth-code-123&state=state-abc`);
    await expect(callbackPromise).resolves.toEqual({ code: 'auth-code-123', state: 'state-abc' });
  });

  it('responds 400 to a callback request missing code or state', async () => {
    listener = new HttpCallbackListenerPort(PORT);
    listener.awaitCallback().catch(() => {});
    await waitUntilListening();

    const response = await fetch(`${BASE_URL}/callback?state=state-abc`);

    expect(response.status).toBe(400);
  });

  it('uses the configured custom path instead of the default /callback', async () => {
    listener = new HttpCallbackListenerPort(PORT, '/custom-redirect');
    const callbackPromise = listener.awaitCallback();
    await waitUntilListening('/custom-redirect');

    await fetch(`${BASE_URL}/custom-redirect?code=auth-code-123&state=state-abc`);

    await expect(callbackPromise).resolves.toEqual({ code: 'auth-code-123', state: 'state-abc' });
  });

  it('treats stop() as a no-op when the listener was never started', async () => {
    listener = new HttpCallbackListenerPort(PORT);

    await expect(listener.stop()).resolves.toBeUndefined();
  });
});
