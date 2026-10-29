# MultiAgentTemplate — Language-Agnostic Tri-Planar Multi-Agent Development Starter

A production-ready, **100% language-agnostic** project template implementing the **Tri-Planar Dual-Loop Multi-Agent Architecture** across **Google Antigravity**, **Claude Code**, **GitHub Copilot**, and **GitHub Actions**, backed by **Git Worktree Isolation** and a **Deterministic Oracle Substrate**.

---

## Quickstart (Bootstrap a New Project)

1. **Copy or clone this template** into `/Users/yuniorsf/WORK/<YourNewProject>`:
   ```bash
   cp -R /Users/yuniorsf/WORK/MultiAgentTemplate /Users/yuniorsf/WORK/<YourNewProject>
   cd /Users/yuniorsf/WORK/<YourNewProject>
   git init -b develop
   ```
2. **Select your language toolchain & Jira ticket prefix** (`typescript`, `python`, `go`, `rust`, `dotnet`, or `generic`):
   ```bash
   ./scripts/init-project-stack.sh python MyNewService PROJ
   ```
   This configures `.harness/harness.env` (formatting, strict build/typecheck/lint, architecture tests, unit tests) and `harness.config.json` (domain-core folders, banned APIs, suppression detectors, SOLID thresholds).
3. **Commit the baseline on `develop`**:
   ```bash
   git add . && git commit -m "chore: bootstrap multi-agent harness"
   ```

---

## Tri-Planar Architecture Overview

| Plane | Agent / Platform | Primary Responsibility | Primary Contracts & Skills |
|---|---|---|---|
| **Control Plane (Outer Loop)** | **Google Antigravity** | Epic/ticket DAG decomposition, isolated Git Worktree provisioning, parallel dispatch (`2A ⊗ 2B`), 3-stage Oracle verification, bounded self-healing (`<= 3` retries with $f^{op}$ rewind), rebase & merge prep. | `.agents/skills/*`, `.antigravity/workflows/*`, `AGENTS.md` |
| **Execution Plane `2A` (Inner Loop — Deep Reasoning)** | **Claude Code** | Domain modeling, Clean/Hexagonal/Onion boundaries, complex algorithms, state machines, concurrency/observability propagation, diagnostic self-healing. | `CLAUDE.md`, `.claude/skills/*`, `.claude/agents/*`, `.claude/commands/*` |
| **Execution Plane `2B` (Inner Loop — Mechanical & QA)** | **GitHub Copilot** | High-velocity DTO/adapter/UI boilerplate, test data builders, narrow segregated mocks, LSP behavioral contract suites, 100%-branch-coverage unit tests, formatting compliance. | `.github/copilot-instructions.md`, `.github/skills/*` |
| **Cloud CI Plane** | **GitHub Actions** | Automated PR review (`claude-auto-pr-review.yml`) and interactive `@claude` PR/issue execution (`claude-on-demand-agent.yml`). | `.github/workflows/*` |

See [`AI-AUGMENTED-DEVELOPMENT.md`](AI-AUGMENTED-DEVELOPMENT.md) for the full operational reference across all layers.

---

## Repository Layout

```text
MultiAgentTemplate/
├── AGENTS.md                              # Universal workspace rules (Antigravity / Codex / Open-standard agents)
├── CLAUDE.md                              # Shared repository & Deep-Reasoning contract (Claude Code + CI)
├── AI-AUGMENTED-DEVELOPMENT.md            # Master guide to all multi-agent layers, commands, and workflows
├── harness.config.json                    # Polyglot SOLID, Clean Architecture, scope & suppression rules
├── .harness/
│   ├── harness.env                        # Active toolchain hooks (INIT, FORMAT, BUILD/LINT, ARCH_TEST, UNIT_TEST)
│   └── profiles/                          # Ready-to-use profiles: typescript-node, python-uv, go, rust, dotnet
├── scripts/
│   ├── init-project-stack.sh              # One-command stack & project initializer
│   ├── agent-sandbox.sh                   # Isolated Git worktree manager (../worktrees/<task-id>)
│   ├── verify-solid-contracts.py          # Fast (<200ms) polyglot SOLID, disjoint-scope & suppression verifier
│   └── verify-agent-worktree.sh           # 3-stage Deterministic Oracle (Exit 0 / 2 / 10 / 20 / 30)
├── .antigravity/
│   └── workflows/                         # Declarative DAG blueprints (code-gen-dag.json, plan-gen-dag.json)
├── .agents/
│   └── skills/                            # Antigravity skills: code-gen-dag, plan-gen-dag,
│                                          # outer-loop-dag-orchestrator, solid-code-synthesizer
├── .claude/
│   ├── agents/                            # 11 specialized personas (10 SDLC + ticket-worker)
│   ├── commands/                          # 5 slash commands (/implement-ticket, /ship-ticket, /orchestrate-tickets,
│   │                                      # /gen-tests, /gen-method-tests)
│   ├── skills/                            # 6 skills: outer-loop-dag-orchestrator, solid-code-synthesizer,
│   │                                      # architecture-conventions, observability-conventions,
│   │                                      # jira-conventions, ui-ux-pro-max
│   └── feature_release_controller.py      # Standalone Anthropic SDK CLI ($feat, $req, $arch, $task, $code, ...)
├── .github/
│   ├── copilot-instructions.md            # GitHub Copilot Inner-Loop Mechanical & QA contract
│   ├── skills/solid-code-synthesizer/     # GitHub Copilot Agent Skill for 5-stage SOLID & QA scaffolding
│   └── workflows/                         # claude-auto-pr-review.yml & claude-on-demand-agent.yml
├── src/core/                              # Pure domain core placeholder (zero infrastructure dependencies)
└── tests/                                 # Automated unit, contract, and architecture tests placeholder
```
