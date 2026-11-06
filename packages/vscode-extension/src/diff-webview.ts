import type { WorktreeDiffSummary } from '@orquestia/core';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderFileRow(file: WorktreeDiffSummary['files'][number]): string {
  return `<tr><td>${escapeHtml(file.path)}</td><td class="ins">+${file.insertions}</td><td class="del">-${file.deletions}</td></tr>`;
}

/**
 * Renders a {@link WorktreeDiffSummary} as a self-contained HTML document
 * for a VS Code webview panel's live diff preview. Pure and `vscode`-free
 * so it can be unit-tested without the Extension Host.
 */
export function renderWorktreeDiffHtml(summary: WorktreeDiffSummary): string {
  if (summary.files.length === 0) {
    return `<!DOCTYPE html><html><body><p class="empty">No changes in ${escapeHtml(summary.worktreePath)}.</p></body></html>`;
  }

  const rows = summary.files.map(renderFileRow).join('\n');
  return `<!DOCTYPE html><html><body><h1>${escapeHtml(summary.worktreePath)}</h1><table>${rows}</table></body></html>`;
}
