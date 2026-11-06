import { describe, expect, it } from 'vitest';
import { groupIssuesIntoBoard } from './kanban-board.js';
import type { BoardIssue } from './types.js';

describe('groupIssuesIntoBoard', () => {
  it('returns no columns for an empty issue list', () => {
    expect(groupIssuesIntoBoard([])).toEqual({ columns: [] });
  });

  it('creates one column per distinct status, ordered by first appearance', () => {
    const issues: BoardIssue[] = [
      { key: 'ORQ-1', summary: 'A', status: 'To Do' },
      { key: 'ORQ-2', summary: 'B', status: 'Done' },
      { key: 'ORQ-3', summary: 'C', status: 'To Do' },
    ];

    const board = groupIssuesIntoBoard(issues);

    expect(board.columns.map((column) => column.status)).toEqual(['To Do', 'Done']);
    expect(board.columns[0]?.issues).toEqual([issues[0], issues[2]]);
    expect(board.columns[1]?.issues).toEqual([issues[1]]);
  });
});
