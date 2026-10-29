# Workspace Agent Rules (`AGENTS.md`)

All AI coding agents operating in this repository (**Google Antigravity**, **Claude Code**, **GitHub Copilot**, and subagents) share the **Tri-Planar Dual-Loop Architecture** defined in [`CLAUDE.md`](CLAUDE.md), [`.github/copilot-instructions.md`](.github/copilot-instructions.md), and [`AI-AUGMENTED-DEVELOPMENT.md`](AI-AUGMENTED-DEVELOPMENT.md).

## Non-Negotiable Invariants

1. **Toolchain Source of Truth**: Read build, format, lint/typecheck, architecture-test, and unit-test commands from [`.harness/harness.env`](.harness/harness.env) and structural boundaries from [`harness.config.json`](harness.config.json). Never hardcode assumptions about a stack without checking `.harness/harness.env`.
2. **Branch Protection**: `develop` (`origin/develop`) is the sole integration branch. Never branch from, commit to, merge into, or rebase `main` or `master`.
3. **Worktree Isolation**: Orchestrated multi-agent tasks execute inside isolated Git worktrees (`../worktrees/<task-id>`) managed via `./scripts/agent-sandbox.sh`.
4. **Deterministic Verification Gate**: Every task must achieve `Exit 0` from both:
   - `python3 scripts/verify-solid-contracts.py --target .`
   - `./scripts/verify-agent-worktree.sh .`
5. **Zero Suppressions**: Never silence compiler, typechecker, or linter diagnostics via inline suppression comments or config overrides.
6. **Domain Core Purity**: Files under `domainCoreDirs` (`src/core/`, `src/domain/`) must remain 100% free of ORM, database, HTTP, broker, or UI framework imports.
