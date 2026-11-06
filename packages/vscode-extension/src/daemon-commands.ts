import type { DaemonClientPort } from '@orquestia/core';

/**
 * Calls a daemon RPC method and formats a human-readable outcome for a
 * VS Code notification — `vscode`-free so the formatting logic is
 * unit-testable without the Extension Host. A connection failure (no
 * daemon listening) and a remote JSON-RPC error both resolve to a
 * failure message rather than throwing, since the only caller is a
 * command handler that just wants one string to show the user.
 */
export async function runDaemonMethod(
  client: DaemonClientPort,
  method: string,
  params?: unknown,
): Promise<string> {
  try {
    const result = await client.call(method, params);
    return `Orquestia: "${method}" completed. ${JSON.stringify(result)}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `Orquestia: "${method}" failed — ${message}. Is the Orquestia daemon running?`;
  }
}
