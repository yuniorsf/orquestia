# Orquestia

Kanban board, live worktree diff previews, and one-click Plan/Code DAG execution for the [Orquestia](https://github.com/yuniorsf/orquestia) Tri-Planar multi-agent orchestrator — directly inside VS Code / Cursor.

## Commands

| Command | What it does |
|---|---|
| **Orquestia: Open Kanban Board** | Shows the linked Jira project's issues grouped by status (needs Atlassian auth wired up first). |
| **Orquestia: Show Worktree Diff Preview** | Summarizes uncommitted changes in the current workspace's active worktree. |
| **Orquestia: Show Configuration** | Renders the workspace's `orquestia.config.yaml` — context condenser, Atlassian, and model-routing layer settings. |
| **Orquestia: Run Plan DAG** | Runs the read-only Planning DAG against the Orquestia daemon for the current workspace. |
| **Orquestia: Run Code DAG** | Runs the Coding DAG (isolated worktree, self-healing, ship) against the Orquestia daemon. |

## Requirements

- A workspace folder open at the root of an Orquestia-managed repository. An `orquestia.config.yaml` at that root enables the configuration view and the Planning DAG's guardrail checks.
- The Orquestia daemon running for the "Run Plan/Code DAG" commands.

## More

See the [Orquestia specification](https://github.com/yuniorsf/orquestia/blob/develop/ORQUESTIA_SPECIFICATION.md) for the full architecture and configuration reference.
