---
name: plan-gen-dag
description: >-
  Orchestrate the 5-phase Blackboard read-only planning and architecture
  verification DAG over the contributors configured in
  orquestia.config.yaml's orchestration.blackboard.contributors[] (today:
  {{WORKER_COUNT}}) with zero code or working-tree changes. Activate when
  the user invokes /plan-gen-dag or asks for a multi-agent implementation
  plan without modifying code.
---

# Blackboard Read-Only Planning Orchestrator (`/plan-gen-dag`)

Act as **Google Antigravity** in the **ControlPlane-OuterLoop (Read-Only Planning)** role defined in [`.antigravity/workflows/plan-gen-dag.json`](../../../.antigravity/workflows/plan-gen-dag.json) and [`.antigravity/workflows/plan-gen-dag.md`](../../../.antigravity/workflows/plan-gen-dag.md).

## Configured Contributors (shared workspace — no disjoint ownership)

{{WORKER_TABLE}}

> **Non-Negotiable Invariant — Zero Repository Changes:**
> Never create, edit, stage, or delete files in the repository workspace, and never create branches, worktrees, or commits during `/plan-gen-dag` (unless `--out <path>` is explicitly passed). Every contributor **must** run strictly read-only.

## Reference Contracts (Read on Demand)

- **Active Toolchain & Rules**: [`.harness/harness.env`](../../../.harness/harness.env) and [`harness.config.json`](../../../harness.config.json)
- **Planning & Execution DAGs**: [`.antigravity/workflows/plan-gen-dag.json`](../../../.antigravity/workflows/plan-gen-dag.json) and [`.antigravity/workflows/code-gen-dag.json`](../../../.antigravity/workflows/code-gen-dag.json)
- **Categorical & SOLID Contracts**: [`../outer-loop-dag-orchestrator/SKILL.md`](../outer-loop-dag-orchestrator/SKILL.md) and [`../solid-code-synthesizer/SKILL.md`](../solid-code-synthesizer/SKILL.md)
- **Per-contributor contracts**: `CLAUDE.md` and `.claude/skills/*/SKILL.md` for Claude-Code-backed contributors; `.github/copilot-instructions.md` and `.github/skills/solid-code-synthesizer/SKILL.md` for Copilot-backed contributors.

---

## Invocation & Parameters

```text
/plan-gen-dag <taskId | description | ticket key> [--base origin/develop] [--retries 3] [--out <path>]
```

- Deliver the verified plan as an **Antigravity Conversation Artifact** in `<artifactDir>/plan-<taskId>.md` (`UserFacing: true`, `RequestFeedback: true`). Only export to `<path>` when `--out <path>` is explicitly passed.

---

## Execution Protocol

### Phase 1 — Read-Only Baseline Snapshot & Scope Grounding
1. Capture `baselineGitStatus` (`git status --porcelain && git rev-parse --short HEAD`) to prove zero workspace mutations.
2. Read `.harness/harness.env`, `harness.config.json`, `CLAUDE.md`, `.github/copilot-instructions.md`, and relevant `.claude/skills/*`. If a Jira key is provided, inspect full issue details without transitioning ticket status.
3. Locate real modules, interfaces, and test suites in the workspace to ground each contributor's brief — do not partition the task; every contributor plans against the same shared scope.

### Phase 2 — Parallel Read-Only Contributor Dispatch
1. Dispatch every configured contributor above, strictly read-only, each free to propose changes to any in-scope file and producing a role-appropriate brief and file-touch manifest (`[NEW]` / `[MODIFY]`).
2. Wait at the join barrier, then merge the contributors' manifests via last-writer-wins (by proposal order when timestamps are unavailable at planning time) for the purpose of this plan's reported manifest.

### Phase 3 — Deterministic Plan Oracle Verification
Audit the combined plan against three gates (Gate 1's disjoint-ownership check does not apply — see `CLAUDE.md` §1):
- **Gate 0 (`Code 2`)**: `git status --porcelain` matches `baselineGitStatus` identically.
- **Gate 2 (`Code 20`)**: Proposed code snippets contain zero `bannedApiPatterns` and zero `suppressionPatterns`.
- **Gate 3 (`Code 30`)**: Zero `forbiddenCoreImports` inside `domainCoreDirs`; ISP/LSP boundaries respected; zero unimplemented stubs; every proposed branch and guard clause has test coverage from a QA/test-oriented contributor.

### Phase 4 — Bounded Plan Self-Healing Loop (`1..maxSelfHealRetries`)
- `Code 20` → Route to the contributor that proposed the offending snippet; replace banned APIs/suppressions, then re-merge with the other contributions.
- `Code 30` → Route to whichever contributor's merged manifest claims the gap; introduce clean domain ports and fill test coverage gaps.

### Phase 5 — Conversation Artifact Synthesis & `/code-gen-dag` Handoff
Write `<artifactDir>/plan-<taskId>.md` containing: (1) Executive Summary & Dependencies, (2) Clean/Hexagonal Mermaid Diagram, (3) Shared Type & Port Contract, (4) Merged Contributor Manifest (post last-writer-wins), (5) 100%-Branch Test & Contract Matrix, (6) Risks & Observability Notes, and (7) Ready-to-run `/code-gen-dag <taskId> ...` handoff command. Confirm `git status --porcelain` remains untouched.
