---
name: plan-gen-dag
description: >-
  Orchestrate the 5-phase Hierarchical N-Worker read-only planning and
  architecture verification DAG over the workers configured in
  orquestia.config.yaml's orchestration.hierarchical_n_worker.workers[]
  (today: {{WORKER_COUNT}}) with zero code or working-tree changes.
  Activate when the user invokes /plan-gen-dag or asks for a multi-agent
  implementation plan without modifying code.
---

# Hierarchical N-Worker Read-Only Planning Orchestrator (`/plan-gen-dag`)

Act as **Google Antigravity** in the **ControlPlane-OuterLoop (Read-Only Planning)** role defined in [`.antigravity/workflows/plan-gen-dag.json`](../../../.antigravity/workflows/plan-gen-dag.json) and [`.antigravity/workflows/plan-gen-dag.md`](../../../.antigravity/workflows/plan-gen-dag.md).

## Configured Workers

{{WORKER_TABLE}}

> **Non-Negotiable Invariant — Zero Repository Changes:**
> Never create, edit, stage, or delete files in the repository workspace, and never create branches, worktrees, or commits during `/plan-gen-dag` (unless `--out <path>` is explicitly passed). All workers **must** run strictly read-only.

## Reference Contracts (Read on Demand)

- **Active Toolchain & Rules**: [`.harness/harness.env`](../../../.harness/harness.env) and [`harness.config.json`](../../../harness.config.json)
- **Planning & Execution DAGs**: [`.antigravity/workflows/plan-gen-dag.json`](../../../.antigravity/workflows/plan-gen-dag.json) and [`.antigravity/workflows/code-gen-dag.json`](../../../.antigravity/workflows/code-gen-dag.json)
- **Categorical & SOLID Contracts**: [`../outer-loop-dag-orchestrator/SKILL.md`](../outer-loop-dag-orchestrator/SKILL.md) and [`../solid-code-synthesizer/SKILL.md`](../solid-code-synthesizer/SKILL.md)
- **Per-worker contracts**: `CLAUDE.md` and `.claude/skills/*/SKILL.md` for Claude-Code-backed workers; `.github/copilot-instructions.md` and `.github/skills/solid-code-synthesizer/SKILL.md` for Copilot-backed workers.

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
2. Read `.harness/harness.env`, `harness.config.json`, `CLAUDE.md`, `.github/copilot-instructions.md`, and relevant `.claude/skills/*`. If a Jira key is provided, inspect full issue details (`Blocks` + prose `"Depends on"`) without transitioning ticket status.
3. Locate real modules, interfaces, and test suites in the workspace to ground each configured worker's brief.

### Phase 2 — Parallel Read-Only Worker Dispatch
1. Dispatch every configured worker above, strictly read-only (`--allowedTools "Read,Glob,Grep"` or subagent with `EnableWriteTools: false`), each producing a role-appropriate brief (architecture/domain design, type & port contracts, test/coverage matrix, etc., per the worker's own role) and a file-touch manifest (`[NEW]` / `[MODIFY]`).
2. Wait at the join barrier until every configured worker completes.

### Phase 3 — Deterministic Plan Oracle Verification
Audit the combined plan against four gates:
- **Gate 0 (`Code 2`)**: `git status --porcelain` matches `baselineGitStatus` identically.
- **Gate 1 (`Code 10`)**: Every `[MODIFY]` file exists on disk; `pairedFileRules` in `harness.config.json` are honored; every pair of configured workers' manifests is disjoint (generalizes the fixed "2A ∩ 2B = ∅" check to all {{WORKER_COUNT}} workers).
- **Gate 2 (`Code 20`)**: Proposed code snippets contain zero `bannedApiPatterns` (raw wall-clock, blocking sync-over-async) and zero `suppressionPatterns` (`eslint-disable`, `@ts-ignore`, `# noqa`, `#[allow(`, `//nolint`, `#pragma warning disable`, `<NoWarn>`).
- **Gate 3 (`Code 30`)**: Zero `forbiddenCoreImports` inside `domainCoreDirs`; ISP role segregation (`Reader` vs. `Writer`) and LSP boundary error parity respected; zero unimplemented stubs; every proposed branch and guard clause from a domain-reasoning worker has test coverage from a QA/test worker.

### Phase 4 — Bounded Plan Self-Healing Loop (`1..maxSelfHealRetries`)
- `Code 10` → Route to whichever worker's manifest overlaps another's; fix paths and re-partition the overlapping scopes.
- `Code 20` → Route to the worker that proposed the offending snippet; replace banned APIs/suppressions with injected Clock and cancellation-aware signatures, then re-sync with the other workers.
- `Code 30` → Route to every worker whose scope intersects the gap; introduce clean domain ports and fill test coverage gaps.

### Phase 5 — Conversation Artifact Synthesis & `/code-gen-dag` Handoff
Write `<artifactDir>/plan-<taskId>.md` containing: (1) Executive Summary & Dependencies, (2) Clean/Hexagonal Mermaid Diagram, (3) Shared Type & Port Contract, (4) Disjoint per-worker Manifest, (5) 100%-Branch Test & Contract Matrix, (6) Risks & Observability Notes, and (7) Ready-to-run `/code-gen-dag <taskId> ...` handoff command. Confirm `git status --porcelain` remains untouched.
