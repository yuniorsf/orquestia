# AI-Augmented Multi-Agent Development Standard

This repository implements a language-agnostic multi-agent orchestration architecture across Outer-Loop DAG orchestration, Inner-Loop specialist execution, editor assistance, and GitHub Actions automation, governed by a **Deterministic Oracle Substrate**. The orchestration **topology** is config-selectable (`orquestia.config.yaml`'s `orchestration.architecture` — see the root `README.md`'s "Switching Orchestration Architectures"); this document describes the default, currently-selected **Tri-Planar Dual-Loop** topology. Switching architectures regenerates the files this document references (`CLAUDE.md`, `.github/copilot-instructions.md`, the skill/command mirrors below, `.antigravity/workflows/*`) via `scripts/init-orchestration.sh` — don't hand-edit them directly, or the next regeneration (or the byte-identity regression test in `packages/cli/src/init-orchestration-generator.test.ts`) will overwrite or flag the drift.

---

## 1. Outer-Loop Orchestration — Google Antigravity

Declarative DAG blueprints live in `.antigravity/workflows/` and executable skills live in `.agents/skills/`:

| Skill / Workflow | Path | Purpose |
|---|---|---|
| `/plan-gen-dag` | `.agents/skills/plan-gen-dag/SKILL.md` | 5-phase **read-only** planning DAG over Claude Code (`2A` architecture) and GitHub Copilot (`2B` contracts & QA matrix) with zero repository mutations. |
| `/code-gen-dag` | `.agents/skills/code-gen-dag/SKILL.md` | 5-phase **isolated worktree** synthesis DAG (`../worktrees/<taskId>`) running parallel `2A ⊗ 2B` branches, dual Oracles, bounded self-healing (`<= 3` retries), and rebase onto `origin/develop`. |
| `outer-loop-dag-orchestrator` | `.agents/skills/outer-loop-dag-orchestrator/SKILL.md` | Macro-level multi-bounded-context DAG composition ($g \circ f$), monoidal parallelization ($A \otimes B$), ISP context projection ($\pi_k$), and dual rollback ($f^{op}$). |
| `solid-code-synthesizer` | `.agents/skills/solid-code-synthesizer/SKILL.md` | 5-stage progressive SOLID & Categorical target-code synthesis and structural verification across any programming language. |

---

## 2. Deterministic Oracle & Sandbox Substrate — `scripts/` & `.harness/`

Language independence is achieved by separating **orchestration invariants** from **toolchain commands**:

- **`.harness/harness.env`**: Declares `INIT_CMD`, `FORMAT_CHECK_CMD`, `FORMAT_FIX_CMD`, `BUILD_AND_LINT_CMD`, `ARCH_TEST_CMD`, and `UNIT_TEST_CMD` (pre-packaged profiles in `.harness/profiles/` for TypeScript/Node, Python/`uv`, Go, Rust, and .NET).
- **`harness.config.json`**: Configures pure-domain directories (`src/core`, `src/domain`), forbidden outer-layer imports, banned APIs, linter/compiler suppression detectors, and SOLID granularity thresholds.
- **`scripts/agent-sandbox.sh`**: Creates, initializes, lists, prunes, and destroys isolated Git worktrees at `../worktrees/<task-id>` forked strictly from `origin/develop` (`main` and `master` are hard-blocked).
- **`scripts/verify-solid-contracts.py`**: Fast (`< 200ms`) polyglot verifier checking monoidal disjoint file ownership (`2A ∩ 2B = ∅`), suppression bans, Clean/Hexagonal domain-core purity, DIP concrete instantiations, LSP unimplemented stubs, and ISP/SRP cohesion metrics.
- **`scripts/verify-agent-worktree.sh`**: Universal 3-stage gatekeeper returning standardized exit codes for self-healing routing:
  - `Exit 0` — All formatting, compiler/linter, SOLID, and architecture checks passed.
  - `Exit 2` — Fatal environment or protected-branch (`main`/`master`) violation.
  - `Exit 10` — Stage 1 formatting/style/scope drift (routed to GitHub Copilot).
  - `Exit 20` — Stage 2 compiler, typecheck, linter, or banned-API violation (routed to Claude Code).
  - `Exit 30` — Stage 3 SOLID, Clean/Hexagonal boundary, or invariant test failure (routed to Claude Code).

---

## 3. Claude Code CLI — Deep Reasoning & Local Tooling (`.claude/`)

`CLAUDE.md` at the repository root is the shared contract read by local sessions, subagents, and GitHub Actions.

### 3.1 Specialized Sub-Agents — `.claude/agents/`

Eleven domain personas (ten SDLC personas plus `ticket-worker` for isolated worktree execution):

| Keyword / Name | Agent File | Role |
|---|---|---|
| `ticket-worker` | `ticket-worker.md` | Autonomous worker executing `/ship-ticket <KEY>` inside an isolated git worktree and handling rebase conflict resolution when resumed by `/orchestrate-tickets` |
| `feat` | `feat-analyzer.md` | Feature feasibility, risk, and complexity assessment |
| `req` | `req-gatherer.md` | Functional/non-functional requirements, user stories, acceptance criteria |
| `arch` | `arch-designer.md` | Architectural patterns, component breakdown, data flow, trade-offs |
| `task` | `task-planner.md` | Granular sprint task decomposition with estimates and sequencing |
| `code` | `code-reviewer.md` | Code quality, OWASP security, performance, and coverage review |
| `test` | `test-agent.md` | Unit, contract, integration, E2E, and load testing strategy |
| `doc` | `doc-writer.md` | API references, ADRs, READMEs, and Keep-a-Changelog release notes |
| `rel` | `rel-manager.md` | Release readiness, canary/blue-green rollout, go/no-go framework |
| `dep` | `dep-automator.md` | CI/CD pipelines, IaC, secrets management, health checks, rollback |
| `ver` | `ver-manager.md` | Git workflows, branching strategy, SemVer, PR hygiene |

### 3.2 Slash Commands — `.claude/commands/`

| Command | File | Behavior |
|---|---|---|
| `/implement-ticket <KEY\|FIRST_TO_DO>` | `implement-ticket.md` | Implements a Jira ticket end-to-end (design, code, tests, Oracle verification, Jira status transitions, commit-granularity plan) leaving changes unstaged and uncommitted for human review. |
| `/ship-ticket <KEY\|FIRST_TO_DO>` | `ship-ticket.md` | Autonomous counterpart: branches from `origin/develop`, implements, passes full Oracle + `UNIT_TEST_CMD` hard-stop gates, commits ending with `(<TICKET-KEY>)`, pushes, and opens a PR targeting `develop`. |
| `/orchestrate-tickets <KEYS\|JQL: ...>` | `orchestrate-tickets.md` | Validates dependency DAG (`Blocks` + prose `"Depends on"`), claims independent tickets serially, spawns up to 5 concurrent `ticket-worker` worktrees, and serially rebases/re-tests/merges PRs into `develop`. |
| `/gen-tests <TypeOrModule>` | `gen-tests.md` | Generates an exhaustive unit test suite targeting 100% branch coverage using the project's native test framework. |
| `/gen-method-tests <Target/Function>` | `gen-method-tests.md` | Generates unit tests covering 100% of branches, guard clauses, null/optional paths, errors, and cancellation paths for a single function/method. |

### 3.3 Domain & Synthesis Skills — `.claude/skills/`

| Skill | Directory | Purpose |
|---|---|---|
| `outer-loop-dag-orchestrator` | `.claude/skills/outer-loop-dag-orchestrator/` | Categorical subagent orchestration, disjoint-scope parallelization, ISP prompt projection, and $f^{op}$ retry rewind. |
| `solid-code-synthesizer` | `.claude/skills/solid-code-synthesizer/` | 5-stage progressive SOLID & Categorical domain synthesis (`SRP → ISP → DIP → OCP/LSP → Boundary Error Semantics`). |
| `architecture-conventions` | `.claude/skills/architecture-conventions/` | Language-agnostic reference guides on Clean/Hexagonal/DDD boundaries, SOLID & DI lifetimes, async cancellation & clock injection, boundary error translation, and contract testing. |
| `observability-conventions` | `.claude/skills/observability-conventions/` | 6 OpenTelemetry reference guides: W3C `traceparent` causality, unified log/trace/metric correlation, high-cardinality structured telemetry, vendor-agnostic OTLP instrumentation, SLO burn-rate alerting, and tail-based sampling. |
| `jira-conventions` | `.claude/skills/jira-conventions/` | Epic + sequential child ticket decomposition, `createJiraIssue` → `editJiraIssue` Markdown pattern, and GitHub-for-Atlassian PR/commit linking. |
| `ui-ux-pro-max` | `.claude/skills/ui-ux-pro-max/` | Searchable local UI/UX design intelligence (`scripts/search.py` + local catalogs across 22 web/mobile/desktop UI stacks). |

### 3.4 Standalone SDLC CLI — `.claude/feature_release_controller.py`

Routes interactive `$feat`, `$req`, `$arch`, `$task`, `$code`, `$test`, `$doc`, `$rel`, `$dep`, and `$ver` queries directly through the Anthropic Python SDK with ephemeral system-prompt caching.

---

## 4. GitHub Copilot & GitHub Actions — `.github/`

- **`.github/copilot-instructions.md`**: Configures GitHub Copilot as the Inner-Loop Mechanical & QA Worker (`Branch 2B` + IDE Agent Mode).
- **`.github/skills/solid-code-synthesizer/SKILL.md`**: Native Agent Skill guiding Copilot through immutable DTO/value-object scaffolding, segregated interface mocks, shared LSP contract suites, and 100% branch coverage.
- **`.github/workflows/claude-auto-pr-review.yml`**: Automated Claude PR review enforcing `develop` target branch, `<TICKET-KEY>` PR/commit conventions, zero linter/compiler suppressions, and Clean/Hexagonal domain boundaries.
- **`.github/workflows/claude-on-demand-agent.yml`**: Interactive `@claude` responder on PRs and issues.
