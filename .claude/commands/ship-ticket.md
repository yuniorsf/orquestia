Implement a Jira ticket end-to-end **and land it**: branch from `origin/develop`, design, code, test, verify Oracles, commit, push, and open a PR targeting `develop` — the autonomous counterpart to `/implement-ticket`. Argument: `<TICKET-KEY>` or `FIRST_TO_DO`.

This is the only slash command allowed to run `git add`, `git commit`, `git push`, and open a PR autonomously.

## Steps

0. **Branch base, non-negotiable.** Read `.harness/harness.env` (`INTEGRATION_BRANCH="origin/develop"`, `MERGE_TARGET_BRANCH="develop"`). If invoked standalone (outside `/orchestrate-tickets`), run `git fetch origin develop` and create a fresh lowercase `<ticket-key>-<slug>` branch explicitly from `origin/develop` — never from the currently checked-out branch and **never** from `main` or `master`.
1. **Execute Steps 1–9 of `/implement-ticket`** (`.claude/commands/implement-ticket.md`): fetch ticket, verify dependencies, transition to `In Progress` (no-op if already `In Progress` under `/orchestrate-tickets`), design, implement, write 100%-branch-coverage tests, pass `verify-solid-contracts.py` and `verify-agent-worktree.sh`, update referenced docs, and transition to `In Review`.
2. **Full-Suite Hard-Stop Gate.** Execute `BUILD_AND_LINT_CMD`, `./scripts/verify-agent-worktree.sh .`, and the full `UNIT_TEST_CMD` configured in `.harness/harness.env`. **Any failure — even one suspected to be pre-existing or unrelated — is an unconditional hard stop.** Do not commit, push, or open a PR on red tests; report exact diagnostics and stop for human adjudication.
3. **Verify diff hygiene** — `git status` / `git diff --stat`.
4. **Commit logically** — follow `/implement-ticket` Step 11 commit-granularity rules; every commit subject must follow `<type>(<scope>): <summary> (<TICKET-KEY>)`.
5. **Push branch** — `git push -u origin <branch>` (never force-push over history not created in this run).
6. **Open PR** — open a pull request targeting `develop` (**never** `main` or `master`) titled `<TICKET-KEY>: <summary>`, linking the ticket and summarizing verification results.
7. **Append Jira `## Resolution` note** including the PR URL, keeping ticket status at `In Review` (never `Done`).
8. **Report back** — branch name, worktree path (if applicable), commit hashes, PR URL, and final ticket state.
