Run multiple independent Jira tickets in parallel, each inside its own isolated Git worktree (`ticket-worker` executing `/ship-ticket`), then serially rebase, re-verify via the Deterministic Oracles, and merge each PR into `develop`. Argument: space/comma-separated ticket keys (e.g. `PROJ-10 PROJ-11`) or `JQL: <query>`.

Default concurrency cap: `5` simultaneous workers (confirm with the user before exceeding 5).

**Branch base, non-negotiable:** Every worktree and branch must fork explicitly from `origin/develop`. `main` and `master` are never touched at any phase. Read toolchain commands (`BUILD_AND_LINT_CMD`, `UNIT_TEST_CMD`) from `.harness/harness.env`.

## Steps

1. **Resolve ticket set** from literal keys or `searchJiraIssuesUsingJql`.
2. **Build dependency DAG & verify parallelizability.** Fetch the **full description** and `issuelinks` of every ticket. Build the union of formal `Blocks` links and prose `"Depends on <KEY>"` references. If any ticket in the batch depends on another ticket in the same batch, **stop and notify the user** rather than spawning dependent worktrees in parallel. Topologically sort independent tickets (tie-breaking by Jira Rank) for Step 6 merge serialization.
3. **Claim tickets serially (one at a time).** Check `getJiraIssue`; skip tickets not in `"To Do"`; transition `"To Do"` tickets to `"In Progress"` serially before spawning workers to eliminate double-claim races.
4. **Spawn isolated workers in parallel.** For each claimed ticket, invoke `.claude/agents/ticket-worker.md` with `isolation: "worktree"` and `name: "<TICKET-KEY>"` (required so the authoring worker remains addressable via `SendMessage` during rebase conflict resolution) with prompt: `"Run /ship-ticket <TICKET-KEY>."` Wait for all workers to complete.
5. **Collect results.** Exclude any worker that did not reach `"pushed branch + open PR + In Review"` and report it for human attention.
6. **Serialized Merge-Back Phase (`develop` only, never `main`).** For each eligible ticket in Step 2 order:
   - Inside its worktree: `git fetch origin develop && git rebase origin/develop`.
   - **If clean rebase**: Re-run `./scripts/verify-agent-worktree.sh .` and full `UNIT_TEST_CMD` **post-rebase**. Any failure (even seemingly unrelated) is a hard stop — exclude from merge and continue to the next ticket. If green: `git push --force-with-lease`, `gh pr checks <number> --watch`, `gh pr merge <number> --rebase --delete-branch`, and clean up the worktree and local branch.
   - **If rebase conflicts**: Send conflict details via `SendMessage` to `to: "<TICKET-KEY>"` so the authoring worker resolves mechanical conflicts in its own worktree, re-runs `./scripts/verify-agent-worktree.sh .` + `UNIT_TEST_CMD`, and pushes with `--force-with-lease`. If the worker detects a semantic behavioral conflict, it must run `git rebase --abort` and escalate for manual resolution.
7. **Final report** — table mapping each ticket to `merged` / `needs-manual-resolution` / `implementation-failed` / `skipped-already-claimed` with PR URLs.
