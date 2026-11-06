# Claude Instructions — Hierarchical N-Worker Multi-Agent Contract (Language-Agnostic)

## 1. Hierarchical N-Worker Multi-Agent Architecture & Operational Contract

This repository operates under a **Hierarchical N-Worker Dual-Loop Architecture** backed by a **Deterministic Oracle Substrate** (`.harness/harness.env` + `harness.config.json`) and **Git Worktree Isolation**:

- **Outer Loop — Google Antigravity (DAG Orchestrator)**: Decomposes epics/tickets into a dependency-aware DAG, provisions isolated Git Worktrees via `scripts/agent-sandbox.sh`, projects minimal ISP task context, dispatches the configured inner-loop workers in parallel, runs `scripts/verify-solid-contracts.py` and `scripts/verify-agent-worktree.sh`, manages bounded self-healing (up to 3 cycles with $f^{op}$ tree-snapshot rollback), and coordinates rebase/merge preparation.
- **Inner Loop Workers** — declared in `orchestration.hierarchical_n_worker.workers[]` (`orquestia.config.yaml`), currently **{{WORKER_COUNT}}** configured:

{{WORKER_TABLE}}

  Each worker owns a strictly disjoint set of file paths from every other worker dispatched in the same phase (generalizes the fixed Tri-Planar "2A/2B" split to an open worker count — see `verify_worker_scopes` in `scripts/verify-solid-contracts.py`, invoked via `--worker-scope <name>:<globs>` once per configured worker).

### Mandatory Execution Rules

1. **Strict Git Worktree Isolation & Protected Branches**:
   - During orchestrated runs, execute all edits, builds, and tests **exclusively inside the assigned Git Worktree** (`../worktrees/<task-id>` or `.claude/worktrees/<id>`).
   - `develop` is the sole integration branch for all agent work. Every new branch or worktree must originate explicitly from `origin/develop` — **never** branch from, checkout, merge into, or rebase `main` or `master`.
2. **No Unverified Commits**:
   - Never run `git commit` or report task completion until both deterministic verifiers pass with exit code `0`:
     ```bash
     python3 scripts/verify-solid-contracts.py --target . --worker-scope "<name-1>:<globs-1>" --worker-scope "<name-2>:<globs-2>" ...
     ./scripts/verify-agent-worktree.sh .
     ```
   - In interactive `/implement-ticket` flows, leave all changes unstaged and uncommitted after verification so the human reviewer can inspect the verified diff.
3. **Zero Tolerance for Linter, Typechecker, or Compiler Suppressions**:
   - Never bypass static analysis by inserting suppression directives (`eslint-disable`, `@ts-ignore`, `@ts-nocheck`, `# noqa`, `# type: ignore`, `#[allow(...)]`, `//nolint`, `#pragma warning disable`, `[SuppressMessage]`, `<NoWarn>`, `@SuppressWarnings`). Fix the underlying architectural or type defect.

---

## 2. Deterministic Self-Healing Loop (Oracle Diagnostics)

Toolchain commands are configured in `.harness/harness.env`. When `./scripts/verify-agent-worktree.sh` returns a non-zero exit code, execute up to **3 bounded self-healing iterations** before escalating:

| Exit Code | Gate Stage | Typical Diagnostics | Required Self-Healing Resolution |
|---|---|---|---|
| `10` | Stage 1: `FORMAT_CHECK_CMD` / Disjoint Scope | Style/whitespace drift, pairwise worker-scope overlap (generalized across all **{{WORKER_COUNT}}** configured workers), paired-file rule miss | Run `FORMAT_FIX_CMD` from `.harness/harness.env` and verify zero unintended semantic diffs; re-partition the overlapping workers' scopes. |
| `20` | Stage 2: `BUILD_AND_LINT_CMD` / Guardrails | Compiler error, strict typecheck mismatch, banned wall-clock/blocking API, suppression directive | Route to the worker that owns the diagnostic's file; resolve type/linter errors in source without suppression comments; inject Clock/Time abstraction and propagate async cancellation. |
| `30` | Stage 3: `verify-solid-contracts.py` + `ARCH_TEST_CMD` | Domain core importing DB/HTTP/ORM packages, concrete adapter instantiation, `NotImplemented` stubs, broken invariant | Route to every worker whose scope intersects the affected domain-core path; move infrastructure behind narrow domain ports (`src/core/` or `src/domain/`), segregate interfaces (`Reader` vs. `Writer`), and repair broken invariants. |

---

## 3. Clean / Hexagonal Architecture & Universal Engineering Conventions

*(fill in project-specific stack details below after running `./scripts/init-project-stack.sh`)*

- **Active Stack Profile**: Defined in `.harness/harness.env` and `harness.config.json`.
- **Pure Domain Core (`src/core/` or `src/domain/`)**:
  - Contains entities, immutable value objects, domain events, business rules, and narrow port interfaces/protocols/traits.
  - **Zero outward dependencies** on ORMs, database drivers, HTTP clients, message brokers, or UI frameworks.
- **Adapters & Infrastructure (`src/adapters/`, `src/infra/`, `src/apps/`)**:
  - Implement domain core ports (persistence repositories, REST/gRPC handlers, message publishers/consumers, UI bindings).
- **Clock & Concurrency Discipline**:
  - Never read global system wall-clock directly inside domain or application logic; inject an abstract Clock / `TimeProvider` (and deterministic fake clock in tests).
  - Never block async event loops/threads with sync-over-async waits or raw sleeps; propagate cancellation tokens/signals/contexts (`AbortSignal`, `context.Context`, `CancellationToken`) end-to-end.
- **Boundary Error Semantics (LSP Parity)**:
  - Use explicit Option/Nullable types (`T | null`, `T | None`, `Option<T>`, `T?`) for expected absence on read queries.
  - Use explicit validation/result structures when callers branch inline on expected multi-error validation outcomes.
  - Maintain documented bidirectional translation between domain errors and network transport envelopes (HTTP `400`/`404`/`409` or gRPC status codes) so remote client adapters and in-process database adapters satisfy identical Liskov behavioral contracts.

---

## 4. Pull Requests, Commits & Scope Discipline

- **PR Title**: Prefix with the primary ticket key: `<TICKET-KEY>: <summary>` (targeting `develop`, never `main`).
- **Commit Subject**: Conventional Commit ending with the ticket key in parentheses: `<type>(<scope>): <summary> (<TICKET-KEY>)` (enables automatic GitHub-for-Atlassian issue linking and `git log --grep` traceability).
- **Minimal Footprint**: Do not add speculative features, unrelated refactors, or comments/docstrings on untouched code. Preserve existing documentation and comments on unrelated lines.
