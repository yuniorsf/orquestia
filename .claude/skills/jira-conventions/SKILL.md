---
name: jira-conventions
description: >-
  Conventions for creating and structuring Jira epics and sequential child
  tickets sized for focused PR review, handling createJiraIssue Markdown
  formatting quirks, and linking PRs/commits automatically. Use when creating,
  splitting, or updating Jira issues.
---

# Jira Conventions (Language-Agnostic)

Read `TICKET_PREFIX` from [`.harness/harness.env`](../../../.harness/harness.env) for the active project key.

## 1. Split Multi-Part Features into an Epic + Sequential Child Tickets

Never file one oversized ticket for a multi-layer feature. Split work along natural architectural build boundaries (e.g., domain model & ports → persistence/infrastructure adapter → API/transport → client/UI) so every child ticket yields one focused, independently testable PR:

- **Umbrella Epic (`Epic`)**: Concise summary, ordered table of child tickets, explicit out-of-scope boundaries, and system-level acceptance criteria. Keep per-file/per-endpoint implementation specs inside the child tickets rather than duplicating them on the Epic.
- **Child Tickets (`Story` / `Task` / `Historia` / `Tarea`)**: Linked via `parent: <EPIC-KEY>`. Each child must build and pass tests standalone on `develop`.
- **Explicit Dependency Edges (Both Formal & Prose)**: Whenever child $N+1$ depends on child $N$, create a formal Jira `Blocks` link **and** state `"Depends on <TICKET-KEY>"` in child $N+1$'s description so both human reviewers and `/orchestrate-tickets` / `/code-gen-dag` detect causal ordering reliably.

## 2. `createJiraIssue` Markdown Workaround — Create, Then Edit

In Atlassian MCP integrations, `createJiraIssue` can flatten multi-paragraph Markdown (headings, tables, code fences) into literal `\n` sequences, whereas `editJiraIssue` preserves full rich formatting:

1. Call `createJiraIssue` with the title, parent/type metadata, and a one-line placeholder summary.
2. Immediately call `editJiraIssue` with the complete Markdown description, acceptance criteria, and dependency notes.

## 3. GitHub-for-Atlassian PR & Commit Traceability

- **Pull Request Title**: `<TICKET-KEY>: <summary>` (or primary/parent `<TICKET-KEY>:` if spanning coupled sub-tasks), always targeting `develop` (never `main`).
- **Commit Subject**: `<type>(<scope>): <summary> (<TICKET-KEY>)` — placing `(<TICKET-KEY>)` at the end of the subject allows GitHub-for-Atlassian to auto-link commits and PRs while keeping `git log --grep` deterministic.
