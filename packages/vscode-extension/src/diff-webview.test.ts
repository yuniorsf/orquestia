import type { WorktreeDiffSummary } from '@orquestia/core';
import { describe, expect, it } from 'vitest';
import { renderWorktreeDiffHtml } from './diff-webview.js';

describe('renderWorktreeDiffHtml', () => {
  it('renders an empty-state message when there are no changed files', () => {
    const summary: WorktreeDiffSummary = { worktreePath: '/worktrees/ORQ-28', files: [] };

    const html = renderWorktreeDiffHtml(summary);

    expect(html).toContain('No changes in /worktrees/ORQ-28');
  });

  it('renders one row per changed file with its insertion/deletion counts', () => {
    const summary: WorktreeDiffSummary = {
      worktreePath: '/worktrees/ORQ-28',
      files: [
        { path: 'src/foo.ts', insertions: 3, deletions: 1 },
        { path: 'src/bar.ts', insertions: 10, deletions: 0 },
      ],
    };

    const html = renderWorktreeDiffHtml(summary);

    expect(html).toContain('/worktrees/ORQ-28');
    expect(html).toContain('src/foo.ts');
    expect(html).toContain('+3');
    expect(html).toContain('-1');
    expect(html).toContain('src/bar.ts');
    expect(html).toContain('+10');
  });

  it('escapes HTML-significant characters in the worktree path', () => {
    const summary: WorktreeDiffSummary = {
      worktreePath: '/worktrees/<ORQ-28>',
      files: [],
    };

    const html = renderWorktreeDiffHtml(summary);

    expect(html).not.toContain('<ORQ-28>');
    expect(html).toContain('&lt;ORQ-28&gt;');
  });
});
