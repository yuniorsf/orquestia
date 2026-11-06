---
name: code-gen-dag
description: >-
  Orchestrate the 5-phase Blackboard code generation and verification DAG
  over the contributors configured in orquestia.config.yaml's
  orchestration.blackboard.contributors[] (today: {{WORKER_COUNT}}),
  dispatched in parallel against a shared workspace and merged by
  last-writer-wins, inside an isolated Git worktree for any language
  stack. Activate when the user invokes /code-gen-dag or asks Antigravity
  to orchestrate a task across the configured blackboard contributors.
---

# Blackboard Outer-Loop Code Synthesis Orchestrator (`/code-gen-dag`)

Act as **Google Antigravity** in the **ControlPlane-OuterLoop** role defined in [`.antigravity/workflows/code-gen-dag.json`](../../../.antigravity/workflows/code-gen-dag.json) and [`.antigravity/workflows/code-gen-dag.md`](../../../.antigravity/workflows/code-gen-dag.md).

## Configured Contributors (shared workspace — no disjoint ownership)

{{WORKER_TABLE}}

## Reference Contracts (Read on Demand)

- **Active Toolchain Profile**: [`.harness/harness.env`](../../../.harness/harness.env) and [`harness.config.json`](../../../harness.config.json)
- **Categorical & SOLID Formalism**: [`../outer-loop-dag-orchestrator/SKILL.md`](../outer-loop-dag-orchestrator/SKILL.md) and [`../solid-code-synthesizer/SKILL.md`](../solid-code-synthesizer/SKILL.md)
- **Sandbox Manager**: [`scripts/agent-sandbox.sh`](../../../scripts/agent-sandbox.sh)
- **Merge logic**: `BlackboardTopology` in `packages/core/src/orchestration/blackboard-topology.ts` — last-writer-wins by logical write timestamp, resolved before anything reaches the real worktree.
- **3-Stage Deterministic Oracle**: [`scripts/verify-agent-worktree.sh`](../../../scripts/verify-agent-worktree.sh) — run **without** `--worker-scope`/`--scope-a`/`--scope-b`; disjoint-ownership is not blackboard's invariant.
- **Per-contributor contracts**: `CLAUDE.md` and `.claude/skills/*/SKILL.md` for Claude-Code-backed contributors; `.github/copilot-instructions.md` and `.github/skills/solid-code-synthesizer/SKILL.md` for Copilot-backed contributors.

---

## Invocation & Parameters

```text
/code-gen-dag <taskId> [description | ticket key] [--base origin/develop] [--retries 3] [--ship]
```

1. **`taskId`** (required, regex `^[a-zA-Z0-9._-]+$`): Normalize `<TICKET-KEY>-<kebab-slug>` if a bare ticket key or prose summary is supplied. Hard-reject `main`, `master`, `develop`, or `origin/*`.
2. **`baseRef`** (default: `origin/develop`): `main`, `origin/main`, `master`, and `origin/master` are permanently forbidden.
3. **`maxSelfHealRetries`** (default: `3`, range: `1..5`).
4. **`--ship`** (default: `false`): When omitted, leave verified changes uncommitted in `../worktrees/<taskId>` for user review; when passed, commit ending with `(<TICKET-KEY>)`, push, and open a PR targeting `develop` only after 100% of Oracle and `UNIT_TEST_CMD` checks pass.

---

## Execution Protocol

### Phase 1 — Task Decomposition & Worktree Initialization
1. Read [`.harness/harness.env`](../../../.harness/harness.env), [`harness.config.json`](../../../harness.config.json), [`CLAUDE.md`](../../../CLAUDE.md), and [`.github/copilot-instructions.md`](../../../.github/copilot-instructions.md). If `taskId` references a Jira issue and Jira MCP tools are available, check formal `Blocks` links and prose `"Depends on <KEY>"` dependencies.
2. Define an upfront **Shared Type/Interface Contract** describing the task — unlike every other architecture, do **not** partition files between contributors; any contributor may touch any in-scope file.
3. Provision the isolated worktree from the repository root:
   ```bash
   ./scripts/agent-sandbox.sh create <taskId> <baseRef>
   ```

### Phase 2 — Parallel Contributor Dispatch Against the Shared Workspace
1. Project the frozen Shared Contract to every configured contributor and dispatch them all in parallel inside `../worktrees/<taskId>`, each free to propose changes to any in-scope file.
2. Inject mandatory guardrails into every contributor: Clean/Hexagonal domain-core purity (`domainCoreDirs`), injected Clock abstraction, async cancellation propagation, zero unimplemented production stubs, and zero linter/compiler suppressions.
3. Wait at the join barrier, then merge all contributions via `BlackboardTopology`'s last-writer-wins resolution **before** writing anything to the real worktree.

### Phase 3 — Deterministic Oracle Verification
1. Run the 3-stage stack Oracle — **no** `--worker-scope`/`--scope-a`/`--scope-b` flags; the merge in Phase 2 already resolved ownership:
   ```bash
   ./scripts/verify-agent-worktree.sh ../worktrees/<taskId>
   ```
2. On `Exit 0`, also run `UNIT_TEST_CMD` from `.harness/harness.env` inside `../worktrees/<taskId>` (treat any test failure as `Exit 30`). Advance to **Phase 5** on green; abort on `Exit 2`; enter **Phase 4** on `Exit 10` / `20` / `30`.

### Phase 4 — Bounded Self-Healing Feedback Loop
Track `healAttempt` (`1..maxSelfHealRetries`). Capture a local tree snapshot (`git -C ../worktrees/<taskId> stash create`) before each retry:
- **`Exit 10` (Formatting Drift only)** → Run `FORMAT_FIX_CMD` from `.harness/harness.env`, then return to **Phase 3**.
- **`Exit 20` (Compiler / Typecheck / Linter / Suppression)** → Route to whichever contributor's merged manifest claims the diagnostic's file; fix without suppression directives, then return to **Phase 3**.
- **`Exit 30` (SOLID / Clean Architecture / Test Failure)** → Route to whichever contributor's merged manifest claims the affected path; refactor leaked infrastructure behind domain ports, then return to **Phase 3**.

If Phase 3 still fails after `maxSelfHealRetries`, halt immediately, preserve `../worktrees/<taskId>`, and report the remaining diagnostics.

### Phase 5 — Rebase, Post-Rebase Re-Verification & Merge Preparation
1. Inside `../worktrees/<taskId>`: `git fetch origin develop && git rebase origin/develop` (route mechanical conflicts to whichever contributor's merged manifest claims the conflicting file; abort & escalate semantic conflicts).
2. Re-run `./scripts/verify-agent-worktree.sh ../worktrees/<taskId>` and `UNIT_TEST_CMD` post-rebase (hard stop on any failure).
3. Without `--ship`, leave changes uncommitted and report worktree path, merged diff summary, Oracle trace, ready-to-use commit message `<type>(<scope>): <summary> (<TICKET-KEY>)`, PR title `<TICKET-KEY>: <summary>`, and cleanup command `./scripts/agent-sandbox.sh destroy <taskId>`. With `--ship`, commit, push, and open the PR targeting `develop`.
