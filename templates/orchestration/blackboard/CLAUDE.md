# Claude Instructions — Blackboard Multi-Agent Contract (Language-Agnostic)

## 1. Blackboard Multi-Agent Architecture & Operational Contract

This repository operates under a **Blackboard Dual-Loop Architecture** backed by a **Deterministic Oracle Substrate** (`.harness/harness.env` + `harness.config.json`) and **Git Worktree Isolation**:

- **Outer Loop — Google Antigravity (DAG Orchestrator)**: Decomposes epics/tickets into a dependency-aware DAG, provisions isolated Git Worktrees via `scripts/agent-sandbox.sh`, dispatches every configured contributor in parallel against a **shared workspace** (not a disjoint partition), merges their contributions via **last-writer-wins** before anything reaches the real worktree, runs `scripts/verify-agent-worktree.sh`, manages bounded self-healing, and coordinates rebase/merge preparation.
- **Inner Loop Contributors** — declared in `orchestration.blackboard.contributors[]` (`orquestia.config.yaml`), currently **{{WORKER_COUNT}}** configured:

{{WORKER_TABLE}}

  **Unlike every other architecture in this contract, contributors do NOT own disjoint file paths.** Any contributor may legitimately propose changes to any file; the orchestrator's merge step (`BlackboardTopology` in `packages/core/src/orchestration/`) resolves a contested path to whichever contribution has the latest logical write timestamp, deterministically. Because the conflict is resolved *before* anything is written to the real worktree, `scripts/verify-solid-contracts.py`'s disjoint-ownership Gate 1 is **not run** for blackboard tasks — passing no `--worker-scope`/`--scope-a`/`--scope-b` flags is correct here, not an oversight.

### Mandatory Execution Rules

1. **Strict Git Worktree Isolation & Protected Branches**:
   - During orchestrated runs, execute all edits, builds, and tests **exclusively inside the assigned Git Worktree** (`../worktrees/<task-id>` or `.claude/worktrees/<id>`).
   - `develop` is the sole integration branch for all agent work. Every new branch or worktree must originate explicitly from `origin/develop` — **never** branch from, checkout, merge into, or rebase `main` or `master`.
2. **No Unverified Commits**:
   - Never run `git commit` or report task completion until the deterministic verifier passes with exit code `0`:
     ```bash
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
| `10` | Stage 1: `FORMAT_CHECK_CMD` | Style/whitespace drift only — no scope-overlap check applies to blackboard | Run `FORMAT_FIX_CMD` from `.harness/harness.env` and verify zero unintended semantic diffs. |
| `20` | Stage 2: `BUILD_AND_LINT_CMD` / Guardrails | Compiler error, strict typecheck mismatch, banned wall-clock/blocking API, suppression directive | Route to whichever contributor's merged manifest claims the diagnostic's file (the last-writer-wins winner); fix without suppression comments. |
| `30` | Stage 3: `verify-solid-contracts.py` + `ARCH_TEST_CMD` | Domain core importing DB/HTTP/ORM packages, concrete adapter instantiation, broken invariant | Route to whichever contributor's merged manifest claims the affected path; move infrastructure behind narrow domain ports and repair broken invariants. |

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
  - Never read global system wall-clock directly inside domain or application logic; inject an abstract Clock / `TimeProvider` (and deterministic fake clock in tests) — this is also exactly what resolves blackboard's own last-writer-wins merge order.
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
