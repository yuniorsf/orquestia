import type { BoardIssue } from './types.js';

export interface KanbanColumn {
  readonly status: string;
  readonly issues: readonly BoardIssue[];
}

export interface KanbanBoard {
  readonly columns: readonly KanbanColumn[];
}

interface MutableColumn {
  readonly status: string;
  readonly issues: BoardIssue[];
}

/** Groups issues into one column per status, columns ordered by each status's first appearance. */
export function groupIssuesIntoBoard(issues: readonly BoardIssue[]): KanbanBoard {
  const columns: MutableColumn[] = [];
  const columnByStatus = new Map<string, MutableColumn>();

  for (const issue of issues) {
    let column = columnByStatus.get(issue.status);
    if (column === undefined) {
      column = { status: issue.status, issues: [] };
      columnByStatus.set(issue.status, column);
      columns.push(column);
    }
    column.issues.push(issue);
  }

  return { columns };
}
