# GitHub Copilot Instructions — Hierarchical N-Worker Mechanical & QA Contract

Within this repository's **Hierarchical N-Worker Dual-Loop Architecture**, **GitHub Copilot** operates as whichever configured worker(s) list it as their agent (complementing Google Antigravity as Outer-Loop DAG Orchestrator and any Claude-Code-backed workers as Deep Reasoning / Architecture specialists). Currently: **{{COPILOT_WORKERS}}**.

## 1. Copilot Responsibilities (Inner-Loop Mechanical & QA)

- **Mechanical Implementation & Boilerplate**: Rapidly scaffold immutable DTOs, value objects, persistence/HTTP adapter bindings, serialization schemas, DI/module registrations, and UI view bindings following established interfaces.
- **Automated Test, Builder & Mock Scaffolding**: Generate exhaustive unit tests, shared fluent `TestDataBuilders`, deterministic fake clocks, narrow interface test doubles, and shared **LSP Contract Test Suites** targeting **100% branch coverage** across happy paths, guard clauses, boundary conditions, error translations, and cancellation paths.
- **Formatting & Oracle Compliance**: Ensure all generated code passes `python3 scripts/verify-solid-contracts.py` and `./scripts/verify-agent-worktree.sh` (using commands defined in `.harness/harness.env`).

## 2. Strictly Banned Patterns (Enforced by `harness.config.json` & Static Analyzers)

- **Zero Linter / Typechecker / Compiler Suppressions**: Never add `eslint-disable`, `@ts-ignore`, `@ts-nocheck`, `# noqa`, `# type: ignore`, `#[allow(...)]`, `//nolint`, `#pragma warning disable`, `[SuppressMessage]`, `<NoWarn>`, or `@SuppressWarnings`.
- **Zero Infrastructure Leakage into Pure Domain Core**: Modules under `src/core/` or `src/domain/` (`domainCoreDirs` in `harness.config.json`) must never import ORMs, database drivers, HTTP clients, message brokers, or UI libraries.
- **Zero Direct System Wall-Clock or Blocking Sync-Over-Async Calls**: Inject a Clock / `TimeProvider` abstraction (using a deterministic fake clock in tests) and propagate async cancellation (`AbortSignal`, `context.Context`, `CancellationToken`) without blocking threads/event loops.
- **Zero Unimplemented Production Stubs**: Never leave `NotImplementedError`, `NotImplementedException`, `todo!()`, `unimplemented!()`, or `throw new Error("Not implemented")` in production adapters. Segregate interfaces (`Reader` vs. `Writer`) instead.

## 3. Build, Format, Lint & Test Commands

Always read [`.harness/harness.env`](../.harness/harness.env) for the active stack's exact commands:

- **Initialize dependencies**: `INIT_CMD`
- **Verify formatting (`Exit 10` check)**: `FORMAT_CHECK_CMD`
- **Auto-fix formatting**: `FORMAT_FIX_CMD`
- **Strict build, typecheck & lint (`Exit 20` check)**: `BUILD_AND_LINT_CMD`
- **SOLID & architecture invariants (`Exit 30` check)**: `python3 scripts/verify-solid-contracts.py --target . --worker-scope "<your-worker-name>:<your-globs>" ...` (one `--worker-scope` per configured worker — see `orquestia.config.yaml`'s `orchestration.hierarchical_n_worker.workers[]`) and `ARCH_TEST_CMD`
- **Full unit & contract test suite**: `UNIT_TEST_CMD`
- **Full 3-Stage Deterministic Oracle**: `./scripts/verify-agent-worktree.sh .`
