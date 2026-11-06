import type { KanbanBoard } from '@orquestia/core';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderColumn(column: KanbanBoard['columns'][number]): string {
  const cards = column.issues
    .map(
      (issue) =>
        `<div class="card"><span class="key">${escapeHtml(issue.key)}</span> ${escapeHtml(issue.summary)}</div>`,
    )
    .join('\n');
  return `<section class="column"><h2>${escapeHtml(column.status)}</h2>${cards}</section>`;
}

/**
 * Renders a {@link KanbanBoard} as a self-contained HTML document for a
 * VS Code webview panel. Pure and `vscode`-free so it can be unit-tested
 * without the Extension Host.
 */
export function renderKanbanBoardHtml(board: KanbanBoard): string {
  if (board.columns.length === 0) {
    return '<!DOCTYPE html><html><body><p class="empty">No issues to display.</p></body></html>';
  }

  const columns = board.columns.map(renderColumn).join('\n');
  return `<!DOCTYPE html><html><body><div class="board">${columns}</div></body></html>`;
}
