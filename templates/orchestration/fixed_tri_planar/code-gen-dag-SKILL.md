---
name: code-gen-dag
description: >-
  Orchestrate the 5-phase Tri-Planar Outer-Loop code generation and verification
  DAG over Claude Code (deep reasoning/domain core) and GitHub Copilot
  (mechanical scaffolding/100%-branch QA) inside an isolated Git worktree for
  any language stack. Activate when the user invokes /code-gen-dag or asks
  Antigravity to orchestrate a task across Claude Code and GitHub Copilot.
---

# Tri-Planar Outer-Loop Code Synthesis Orchestrator (`/code-gen-dag`)

Act as **Google Antigravity** in the **ControlPlane-OuterLoop** role defined in [`.antigravity/workflows/code-gen-dag.json`](../../../.antigravity/workflows/code-gen-dag.json) and [`.antigravity/workflows/code-gen-dag.md`](../../../.antigravity/workflows/code-gen-dag.md).

## Reference Contracts (Read on Demand)

- **Active Toolchain Profile**: [`.harness/harness.env`](../../../.harness/harness.env) and [`harness.config.json`](../../../harness.config.json)
- **Categorical & SOLID Formalism**: [`../outer-loop-dag-orchestrator/SKILL.md`](../outer-loop-dag-orchestrator/SKILL.md) and [`../solid-code-synthesizer/SKILL.md`](../solid-code-synthesizer/SKILL.md)
- **Sandbox Manager**: [`scripts/agent-sandbox.sh`](../../../scripts/agent-sandbox.sh)
- **Polyglot SOLID & Disjoint-Scope Verifier**: [`scripts/verify-solid-contracts.py`](../../../scripts/verify-solid-contracts.py)
- **3-Stage Deterministic Oracle**: [`scripts/verify-agent-worktree.sh`](../../../scripts/verify-agent-worktree.sh)
- **Claude Code Contract (Branch 2A)**: [`CLAUDE.md`](../../../CLAUDE.md) and `.claude/skills/*/SKILL.md`
- **GitHub Copilot Contract (Branch 2B)**: [`.github/copilot-instructions.md`](../../../.github/copilot-instructions.md) and [`.github/skills/solid-code-synthesizer/SKILL.md`](../../../.github/skills/solid-code-synthesizer/SKILL.md)

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
2. Define an upfront **Shared Type/Interface Contract** (exact module paths, types, port signatures, injected Clock/Time abstraction, and cancellation parameters) and partition files with **strictly disjoint ownership (`2A ∩ 2B = ∅`)**:
   - **`coreLogicSpec` (Branch 2A — `claude-code`)**: Pure domain models, business invariants, algorithms, port definitions, and architectural wiring.
   - **`testAndBoilerplateSpec` (Branch 2B — `github-copilot`)**: Disjoint DTO/adapter boilerplate, `TestDataBuilders`, narrow mocks, shared LSP contract suites, and unit tests targeting 100% branch coverage.
3. Provision the isolated worktree from the repository root:
   ```bash
   ./scripts/agent-sandbox.sh create <taskId> <baseRef>
   ```

### Phase 2 — Parallel Inner-Loop Dispatch (`2A ⊗ 2B`)
1. Probe inner-loop CLI availability (`command -v claude`, `command -v copilot`).
2. Project minimal **ISP task context ($\pi_k$)** to each branch (only the frozen Shared Contract, its owned target paths, and direct upstream ports) and dispatch in parallel inside `../worktrees/<taskId>`:
   - **Branch 2A (`claude-code`)**: Run headless `claude -p ...` if available, else launch a `claude-code-specialist` subagent (`EnableWriteTools: true`) restricted to `../worktrees/<taskId>` and `2A` paths.
   - **Branch 2B (`github-copilot`)**: Run headless `copilot` CLI if available, else launch a `github-copilot-worker` subagent (`EnableWriteTools: true`) restricted to `../worktrees/<taskId>` and `2B` paths.
3. Inject mandatory guardrails into both branches: Clean/Hexagonal domain-core purity (`domainCoreDirs`), injected Clock abstraction, async cancellation propagation, zero unimplemented production stubs, and zero linter/compiler suppressions.
4. Wait at the join barrier until both `2A` and `2B` finish.

### Phase 3 — Deterministic Oracle Verification
1. Run the fast polyglot SOLID & Disjoint-Scope Pre-Flight (< 1s):
   ```bash
   python3 scripts/verify-solid-contracts.py --target ../worktrees/<taskId> --base <baseRef> --scope-a "<2A-paths>" --scope-b "<2B-paths>"
   ```
2. Run the 3-stage stack Oracle:
   ```bash
   ./scripts/verify-agent-worktree.sh ../worktrees/<taskId>
   ```
3. On `Exit 0`, also run `UNIT_TEST_CMD` from `.harness/harness.env` inside `../worktrees/<taskId>` (treat any test failure as `Exit 30`). Advance to **Phase 5** on green; abort on `Exit 2`; enter **Phase 4** on `Exit 10` / `20` / `30`.

### Phase 4 — Bounded Self-Healing Feedback Loop
Track `healAttempt` (`1..maxSelfHealRetries`). Capture a local tree snapshot (`git -C ../worktrees/<taskId> stash create`) before each retry so non-convergent edits can be rewound cleanly ($f^{op}$):
- **`Exit 10` (Formatting / Scope Drift) → `github-copilot`**: Run `FORMAT_FIX_CMD` from `.harness/harness.env` without altering domain logic, then return to **Phase 3**.
- **`Exit 20` (Compiler / Typecheck / Linter / Suppression) → `claude-code`**: Fix reported diagnostics in source without suppression directives, then return to **Phase 3**.
- **`Exit 30` (SOLID / Clean Architecture / Test Failure) → `claude-code`**: Refactor leaked infrastructure behind domain ports or repair broken invariants (updating test setup via `github-copilot` only if the test contradicted the spec), then return to **Phase 3**.

If Phase 3 still fails after `maxSelfHealRetries`, halt immediately, preserve `../worktrees/<taskId>`, and report the remaining diagnostics.

### Phase 5 — Rebase, Post-Rebase Re-Verification & Merge Preparation
1. Inside `../worktrees/<taskId>`: `git fetch origin develop && git rebase origin/develop` (route mechanical conflicts to `claude-code`; abort & escalate semantic conflicts).
2. Re-run `./scripts/verify-agent-worktree.sh ../worktrees/<taskId>` and `UNIT_TEST_CMD` post-rebase (hard stop on any failure).
3. Without `--ship`, leave changes uncommitted and report worktree path, `2A` vs. `2B` diff summary, Oracle trace, ready-to-use commit message `<type>(<scope>): <summary> (<TICKET-KEY>)`, PR title `<TICKET-KEY>: <summary>`, and cleanup command `./scripts/agent-sandbox.sh destroy <taskId>`. With `--ship`, commit, push, and open the PR targeting `develop`.
