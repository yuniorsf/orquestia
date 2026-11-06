import type { KanbanBoard } from '@orquestia/core';
import { describe, expect, it } from 'vitest';
import { renderKanbanBoardHtml } from './kanban-webview.js';

describe('renderKanbanBoardHtml', () => {
  it('renders an empty-state message when there are no columns', () => {
    const html = renderKanbanBoardHtml({ columns: [] });

    expect(html).toContain('No issues to display.');
  });

  it('renders one column section with one card per issue', () => {
    const board: KanbanBoard = {
      columns: [
        {
          status: 'To Do',
          issues: [{ key: 'ORQ-1', summary: 'First issue', status: 'To Do' }],
        },
        {
          status: 'Done',
          issues: [
            { key: 'ORQ-2', summary: 'Second issue', status: 'Done' },
            { key: 'ORQ-3', summary: 'Third issue', status: 'Done' },
          ],
        },
      ],
    };

    const html = renderKanbanBoardHtml(board);

    expect(html).toContain('To Do');
    expect(html).toContain('Done');
    expect(html).toContain('ORQ-1');
    expect(html).toContain('First issue');
    expect(html).toContain('ORQ-2');
    expect(html).toContain('ORQ-3');
  });

  it('escapes HTML-significant characters in issue summaries', () => {
    const board: KanbanBoard = {
      columns: [
        {
          status: 'To Do',
          issues: [{ key: 'ORQ-1', summary: '<script>alert("x")</script>', status: 'To Do' }],
        },
      ],
    };

    const html = renderKanbanBoardHtml(board);

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&quot;');
  });
});
