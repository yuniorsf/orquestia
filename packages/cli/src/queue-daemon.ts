#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  ConcurrentQueueManager,
  GitWorktreeProvisioner,
  JsonRpcDispatcher,
  UnixSocketServer,
  registerQueueRpcMethods,
} from '@orquestia/core';

// This is the real daemon process entry point — launched detached by
// ChildProcessDaemonLauncher via `node queue-daemon.js <cwd>`. There is
// no harness here to run it as a genuine standalone background process
// and assert on its lifecycle, so — like the CLI's other bootstrap
// files — it is excluded from coverage; registerQueueRpcMethods (the
// logic it wires up) is fully covered against a real JsonRpcDispatcher
// and a fake worktree provisioner.

const cwd = process.argv[2] ?? process.cwd();
const orquestiaDir = join(cwd, '.orquestia');
const socketPath = join(orquestiaDir, 'daemon.sock');
const pidFilePath = join(orquestiaDir, 'daemon.pid');
const worktreesRoot = join(cwd, '..', 'worktrees');

const manager = new ConcurrentQueueManager(new GitWorktreeProvisioner(cwd, worktreesRoot), {
  maxParallelTasks: 3,
  autoCleanupOnMerge: true,
});

const dispatcher = new JsonRpcDispatcher();
registerQueueRpcMethods(dispatcher, manager);

const server = new UnixSocketServer(socketPath, dispatcher);

async function shutdown(): Promise<void> {
  await server.stop();
  process.exit(0);
}

dispatcher.registerMethod('daemon.stop', async () => {
  setImmediate(() => {
    void shutdown();
  });
  return { stopping: true };
});

await mkdir(orquestiaDir, { recursive: true });
await server.start();
await writeFile(pidFilePath, String(process.pid), 'utf8');

process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
