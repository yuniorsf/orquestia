---
name: orquestia-implement
description: >-
  Implements a feature by driving the REAL `orquestia` CLI binary as an
  external tool — not by having Claude Code synthesize the code itself the
  way /code-gen-dag does. Defines a clear task description first (a Jira
  ticket or a free-text prompt), invokes `orquestia plan`/`orquestia code`
  with full trace verbosity, follows its logs through the whole DAG
  (dispatch, self-healing, rebase), and independently validates what
  Orquestia actually produced against what was asked. Activate when the
  user invokes /orquestia-implement or asks to use Orquestia itself
  (not Claude Code directly) to implement a feature.
---

# Orquestia-Driven Implementation (`/orquestia-implement`)

Claude's role here is **supervisor, not implementer**: define the task clearly, run the real `orquestia` CLI, watch what it does, and verify the result independently. The actual code synthesis is Orquestia's job — dispatched to whichever agents `orquestia.config.yaml`'s `layers.*` resolve to (see `resolveAgentRoutingConfig`, `packages/core/src/agents/agent-routing-resolver.ts`). Never bypass the CLI and implement the feature directly unless Phase 2 explicitly tells you to escalate.

## Reference Contracts (Read on Demand)

- **CLI entry point**: `packages/cli/src/main.ts` (`runCli`, global flags `-v`/`-vv`/`-vvv`/`--verbosity`, `--config <profile>`)
- **Coding DAG internals**: `packages/cli/src/code-command.ts`, `code-command-wiring.ts`
- **Planning DAG internals**: `packages/cli/src/plan-command.ts`
- **Worktree lifecycle**: `scripts/agent-sandbox.sh`
- **Deterministic Oracle (independent re-check)**: `scripts/verify-solid-contracts.py`, `scripts/verify-agent-worktree.sh`
- **Jira conventions**: `.claude/skills/jira-conventions/SKILL.md` (if a real ticket is involved)

---

## Invocation & Parameters

```text
/orquestia-implement <ticket-key | free-text description> [--ship] [--config <profile>]
```

- **`--ship`** (default: `false`): forwarded to `orquestia code` only after Phase 3's independent validation passes, not just Orquestia's own oracle.
- **`--config <profile>`**: forwarded to every `orquestia` invocation unchanged, selecting a `.orquestia/configs/<profile>.yaml` routing profile instead of the default.

### A known, real limitation to design around

**The real `orquestia` CLI has no free-text prompt parameter today.** `orquestia plan <taskId>` / `orquestia code <taskId>` read *only* `taskId` from `args[0]`, and interpolate that exact string, verbatim, as the entire prompt every dispatched agent receives (`packages/core/src/planning/agent-specialist-dispatcher.ts`'s `buildPrompt`). There is no richer channel for task content to reach the dispatch step. So:

- A **Jira ticket key** (e.g. `ORQ-123`) becomes `taskId` directly.
- A **free-text description** has no separate home — it must be compressed into a single, maximally descriptive, branch-name-safe slug (`^[a-zA-Z0-9._-]+$`) that *is* the `taskId`, since that slug is literally the only content Orquestia's dispatched agents will ever see. Phase 1 exists specifically to make that compression as lossless as reasonably possible.

If `orquestia implement <taskId> "<prompt>"` (a real free-text-prompt-carrying command, discussed but not yet built) lands later, Phase 1's job simplifies to just passing the prompt through unmodified — update this file then.

---

## Execution Protocol

### Phase 1 — Define a Clear Task Description

1. **If given a Jira ticket key**: fetch it (Atlassian MCP tools, if connected) and confirm it has a clear, actionable description. If it doesn't, say so and ask the user to clarify *before* proceeding — do not guess at missing requirements. Use the ticket key as `<taskId>` verbatim.
2. **If given free text**: this is the feature's real specification, but — per the limitation above — it will *not* reach Orquestia's dispatched agents as prose. Derive a `<taskId>` slug that packs as much of the essential "what" into the slug itself as fits a branch name cleanly (e.g. `add-rate-limit-header-to-http-adapter`, not `ORQ-999-misc`). Keep the full free-text description in your own context for Phase 3's validation — Orquestia will never see it, but you need it to judge the result afterward.
3. State the resolved `<taskId>` back to the user before continuing, so there's no ambiguity about what Orquestia is about to be asked to do.

### Phase 2 — Invoke Orquestia, Follow the Logs

1. **Read-only pass first**: `npx orquestia plan <taskId> -vvv`. This is zero-mutation — safe to run and re-run. Report the proposed 2A/2B file manifests and the Plan Oracle verdict (advisory — `Gate 30`'s "coverage matrix" check in particular is known to flag a real `.test.ts` pairing heuristic that doesn't block `code`, not a hard failure).
2. **Disjoint-allocation collision** (`Disjoint file allocation violated...`, exit before any worktree exists): safe to retry — nothing was written. Retry **at most twice**. If it still collides on the third attempt, **stop calling the CLI** and report to the user instead of silently implementing the feature yourself — this command's whole point is that Orquestia does the work; looping indefinitely burns real cost without changing the root cause (see the "why do they collide" discussion: two independent dispatches guessing the same under-specified small task). Report which files collided and in which role, so the user can decide whether to split the task differently or implement it another way.
3. **Once `plan` looks reasonable**, run the real thing: `npx orquestia code <taskId> -vvv` (run in the background if it doesn't return within ~2 minutes — Antigravity/Claude dispatches have taken anywhere from 20s to 8 minutes in practice). Stream/read the trace as it completes: branch/agent attribution (`[2A→...]`/`[2B→...]`), dispatch duration, self-healing attempts and their exit codes, rebase outcome.
4. **Malformed JSON / agent timeout on a single dispatch**: also safe to retry (bounded, same 2-attempt cap as above) — these are known, occasionally-transient live-dispatch failures (see ORQ-101/ORQ-103 history), not structural.
5. **Rebase step**: `RebaseAndReverifyService` has no `--autostash` (open issue, GitHub #47) — it will fail with "cannot rebase: you have unstaged changes" if `code` leaves anything uncommitted, which it always does without `--ship`. If you need Phase 2 to get past the rebase step for inspection purposes, use the same workaround established earlier in this project: temp-commit → `git fetch origin develop && git rebase origin/develop` → `git reset HEAD~1` to return to uncommitted. Only do this if truly necessary for validation; otherwise leave it to `orquestia code`'s own `--ship` path to handle.
6. Leave the worktree (`../worktrees/<taskId>`) in whatever state `orquestia code` left it in for Phase 3 — don't clean it up yet.

### Phase 3 — Validate What Orquestia Actually Produced

Orquestia's own internal oracle (format → build/lint → SOLID/architecture → tests) already ran as part of `code`. This phase is an **independent** check layered on top — the question isn't "did it pass the build," it's "did it actually do what was asked":

1. Re-run the deterministic gates yourself, from outside the CLI, as a sanity check the CLI's own self-report is trustworthy: `python3 scripts/verify-solid-contracts.py --target ../worktrees/<taskId> --base origin/develop` and `./scripts/verify-agent-worktree.sh <absolute-path-to-worktree>` (use an absolute path — the script has a known relative-path bug on Stage 3, GitHub #48).
2. Read the actual diff (`git -C ../worktrees/<taskId> diff origin/develop`) and compare it against the real requirement from Phase 1 (the Jira ticket's description, or the original free-text prompt you kept in context) — not against the compressed `taskId` slug. Call out explicitly: did it do what was asked? Did it do *more* than asked (scope creep)? Did it do something different from what either the slug or the ticket implied?
3. Check test coverage meaningfully, not just that `npm test` exited 0 — are the new tests actually exercising the new behavior, or just padding coverage numbers?
4. Report a clear verdict: ship-ready, needs a fix (name exactly what and why), or doesn't match the ask (name the gap).

### Phase 4 — Disposition

- If Phase 3 passes and `--ship` was requested: re-run `orquestia code <taskId> --ship` (or let the already-completed run's `--ship` result stand, if Phase 2 already included it) and report the PR URL.
- If Phase 3 passes without `--ship`: report the worktree path and your validation findings; leave it uncommitted for the user's own review, per standard practice.
- If Phase 3 finds a real gap: report it plainly. Do not silently patch the worktree yourself to paper over it — that defeats the purpose of validating Orquestia's own output. Ask the user how they want to proceed (re-run `orquestia code` with a clearer `taskId`/ticket, or take it over manually).
