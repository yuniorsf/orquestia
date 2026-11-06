import { join } from 'node:path';
import { GitWorktreeDiffPort, ShellCommandRunner, UnixSocketClient } from '@orquestia/core';
import * as vscode from 'vscode';
import { runDaemonMethod } from './daemon-commands.js';
import { renderWorktreeDiffHtml } from './diff-webview.js';

// This is the only file in the package that imports `vscode` — everything
// it delegates to (the webview HTML renderers, the diff/board domain
// ports) is `vscode`-free and unit-tested without the Extension Host.
// There is no harness here to actually launch VS Code and exercise this
// file, so it is excluded from coverage like the CLI's bin bootstrap.

async function showWorktreeDiff(): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    void vscode.window.showErrorMessage('Orquestia: open a worktree folder first.');
    return;
  }

  const worktreePath = workspaceFolder.uri.fsPath;
  const diffPort = new GitWorktreeDiffPort(new ShellCommandRunner(worktreePath));
  const summary = await diffPort.summarize(worktreePath);

  const panel = vscode.window.createWebviewPanel(
    'orquestiaWorktreeDiff',
    'Orquestia: Worktree Diff',
    vscode.ViewColumn.Beside,
    {},
  );
  panel.webview.html = renderWorktreeDiffHtml(summary);
}

function openKanbanBoard(): void {
  // Fetching real issues needs an authenticated IssueBoardPort, which
  // depends on the `auth` credential vault wiring tracked separately
  // (ORQ-36) — the rendering side (kanban-webview.ts) is already real and
  // tested, ready to wire in once that lands.
  void vscode.window.showInformationMessage(
    'Orquestia: the Jira Kanban board needs Atlassian auth wired up first — not available yet.',
  );
}

async function runOneClickDag(method: 'plan.run' | 'code.run'): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    void vscode.window.showErrorMessage('Orquestia: open a worktree folder first.');
    return;
  }

  const cwd = workspaceFolder.uri.fsPath;
  const socketPath = join(cwd, '.orquestia', 'daemon.sock');
  const client = new UnixSocketClient(socketPath);
  const message = await runDaemonMethod(client, method, { cwd });
  void vscode.window.showInformationMessage(message);
}

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('orquestia.showWorktreeDiff', showWorktreeDiff),
    vscode.commands.registerCommand('orquestia.openKanbanBoard', openKanbanBoard),
    vscode.commands.registerCommand('orquestia.runPlanDag', () => runOneClickDag('plan.run')),
    vscode.commands.registerCommand('orquestia.runCodeDag', () => runOneClickDag('code.run')),
  );
}

export function deactivate(): void {}
