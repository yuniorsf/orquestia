# Orquestia

**Multi-agent development lifecycle orchestrator & ALM bridge** — unifies consumer-tier AI subscriptions (Claude Pro, ChatGPT Plus, GitHub Copilot Pro, Google Antigravity) into deterministic, end-to-end software delivery pipelines.

**Spec Version**: 3.0.0 · **Status**: APPROVED / ARCHITECTURE BASELINE · Full design: [`ORQUESTIA_SPECIFICATION.md`](ORQUESTIA_SPECIFICATION.md)

---

## Why

Consumer AI subscriptions are browser-first and siloed: anti-scraping ToS blocks programmatic use, and parallel Pay-As-You-Go API keys are often the only official way to automate them. Engineers end up manually relaying prompts, context, and verification errors across browser tabs and local IDE sessions.

Orquestia bridges those subscriptions through a non-invasive **Local Session Bridge**, and drives work through two deterministic, DAG-governed macro-workflows that integrate directly with Jira/Confluence and secure credential storage (SQLCipher or HashiCorp Vault):

1. **Planning DAG** (`/orquestia-plan-dag`) — read-only, 5-phase exploration and architecture synthesis.
2. **Coding DAG** (`/orquestia-code-dag`) — isolated, 5-phase implementation and self-healing protocol executed inside dedicated Git worktrees.

## Architecture

```
Presentation:   VS Code / Cursor Extension (.vsix)   |   Autonomous CLI (orquestia binary)
                              │
Core Kernel:    Durable Approval Manager  ⇄  Concurrent Queue Manager (Git worktree pool)
                Planning DAG Subsystem    ⇄  Coding DAG Subsystem
                              │
Adapters:       Agent Adapters (Smart Fallback Router)  |  Workspace Engine (AST/Tree-sitter, Git worktrees, Atlassian client)  |  Security Vault Layer (IVaultProvider)
```

See [`ORQUESTIA_SPECIFICATION.md § 2`](ORQUESTIA_SPECIFICATION.md#2-high-level-architecture-overview) for the full layered diagram.

### Planning DAG (`/orquestia-plan-dag`)
Zero-mutation exploratory pipeline: baseline snapshot → parallel 2A (architecture/domain, Claude Code) ⊗ 2B (contracts/QA matrix, Copilot) dispatch → deterministic plan oracle (zero-mutation, disjoint scope, static guardrails, layer isolation gates) → bounded self-healing → verified spec synced to Confluence/Jira.

### Coding DAG (`/orquestia-code-dag`)
Consumes a verified plan or Jira key, provisions an isolated Git worktree, runs concurrent code synthesis over disjoint file ownership (2A core logic ⊗ 2B tests/boilerplate), subjects the result to a 4-stage deterministic oracle (SOLID pre-flight, format/lint, compile/static guardrails, tests/invariants), self-heals with checkpointed rollback ($f^{op}$), then rebases, re-verifies, and ships (`--ship` → commit, push, PR, Jira transition).

Full phase-by-phase flow: [`ORQUESTIA_SPECIFICATION.md § 3`](ORQUESTIA_SPECIFICATION.md#3-core-functional-subsystems).

## Security

Secret storage is decoupled behind an `IVaultProvider` abstraction with two interchangeable backends:

- **SQLCipherVaultProvider** — local, `~/.orquestia/vault.db`, AES-256 encryption keyed via the OS keyring (macOS Keychain / Windows Credential Manager).
- **HashiCorpVaultProvider** — enterprise, HTTP API, OIDC/AppRole/Token auth, corporate audit & RBAC.

Atlassian access uses OAuth 2.0 (3LO) with PKCE via an ephemeral loopback listener — no long-lived static API tokens. See [`ORQUESTIA_SPECIFICATION.md § 4`](ORQUESTIA_SPECIFICATION.md#4-multi-tier-security--secret-storage-architecture).

## Resilience

- **AST Repo-Map Context Condenser** (Tree-sitter) — projects an ISP-minimal context ($\pi_k$) of exported signatures/ports to stay within consumer LLM context budgets.
- **Smart Fallback Routing** — reroutes to an auxiliary provider on rate-limit/quota exhaustion, auto-resuming the primary after cooldown.
- **Bounded Self-Healing with Dual Rollback** — each repair attempt is checkpointed (`git stash create`); a regression triggers immediate rollback before trying an alternate strategy.
- **Durable Human-in-the-Loop Approvals** — pushes, rebases, and ship actions can be gated behind explicit developer sign-off, persisted in `.orquestia/state.json`.

Details: [`ORQUESTIA_SPECIFICATION.md § 5`](ORQUESTIA_SPECIFICATION.md#5-advanced-resilience--context-management).

## Monorepo Layout (Target)

```text
orquestia-monorepo/
├── orquestia.config.yaml
├── packages/
│   ├── core/        # Kernel: dag/, oracles/, approvals/, queue/, security/, workspace/
│   ├── cli/          # Autonomous CLI (`orquestia` binary — plan, code, auth, queue, approvals)
│   └── vscode/       # VS Code / Cursor extension (.vsix)
└── .orquestia/       # Runtime: specs/, worktrees/, state.json, vault.db
```

Full tree: [`ORQUESTIA_SPECIFICATION.md § 6`](ORQUESTIA_SPECIFICATION.md#6-monorepo-structure--directory-organization).

## Configuration

Project behavior — vault backend, Atlassian sync, concurrency limits, approval gates, context condenser budget, agent/fallback routing, stack toolchain commands, and both DAG specs — is declared in `orquestia.config.yaml`. See the annotated reference: [`ORQUESTIA_SPECIFICATION.md § 7`](ORQUESTIA_SPECIFICATION.md#7-configuration-specification-orquestiaconfigyaml).

## Distribution

- **`@orquestia/cli`** — global npm install or a self-contained Bun/Node SEA binary; runs the background daemon, worktree pool, and headless CI/CD execution.
- **VS Code / Cursor extension** (`orquestia-3.0.0.vsix`) — Kanban views for Jira, live diff previews per worktree, task palette, one-click `/orquestia-plan-dag` and `/orquestia-code-dag`, communicating with the daemon over IPC/JSON-RPC.

Details: [`ORQUESTIA_SPECIFICATION.md § 8`](ORQUESTIA_SPECIFICATION.md#8-product-distribution--packaging-model).

---

## Building This Repository

Orquestia's own codebase is developed using the **Tri-Planar Dual-Loop Multi-Agent Architecture** — the same class of orchestration this project ships to others, applied reflexively to itself (Google Antigravity as outer-loop DAG orchestrator, Claude Code for domain/architecture reasoning, GitHub Copilot for mechanical QA scaffolding, backed by a Deterministic Oracle Substrate and Git worktree isolation).

| Plane | Agent | Responsibility | Contracts |
|---|---|---|---|
| Control Plane (Outer Loop) | Google Antigravity | DAG decomposition, worktree provisioning, parallel dispatch, oracle verification, bounded self-healing | `.agents/skills/*`, `AGENTS.md` |
| Execution Plane 2A | Claude Code | Domain modeling, Clean/Hexagonal boundaries, concurrency/observability | `CLAUDE.md`, `.claude/skills/*`, `.claude/commands/*` |
| Execution Plane 2B | GitHub Copilot | DTO/adapter boilerplate, mocks, 100%-branch-coverage tests | `.github/skills/*` |
| Cloud CI Plane | GitHub Actions | Automated PR review and `@claude` on-demand execution | `.github/workflows/*` |

Full operational reference: [`AI-AUGMENTED-DEVELOPMENT.md`](AI-AUGMENTED-DEVELOPMENT.md). Harness bootstrap:

```bash
./scripts/init-project-stack.sh <typescript|generic> <ProjectName> <TICKET_PREFIX>
python3 scripts/verify-solid-contracts.py --target .
./scripts/verify-agent-worktree.sh .
```

### Building the VS Code Extension (`.vsix`)

`@orquestia/core` must be built first so the extension can resolve its type declarations:

```bash
npm run build --workspace=@orquestia/core
npm run build:vsix --workspace=orquestia
```

Produces `packages/vscode-extension/dist/orquestia.vsix`, installable via `code --install-extension packages/vscode-extension/dist/orquestia.vsix`.
