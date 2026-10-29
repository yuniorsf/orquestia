Implement an issue/Jira ticket end-to-end: design, code, test, and verify — moving the ticket's Jira status forward at each real step (when Jira MCP tools are connected), while **never** staging, committing, or pushing changes so the human reviewer can inspect the verified working tree directly. Argument: the ticket key (e.g. `PROJ-42`), or the literal `FIRST_TO_DO`.

Parse `$ARGUMENTS` as the ticket key. If empty, ask for one instead of guessing. Read `TICKET_PREFIX` and active toolchain commands from `.harness/harness.env`.

If `$ARGUMENTS` is `FIRST_TO_DO`, query `searchJiraIssuesUsingJql` with `project = <TICKET_PREFIX> AND status = "To Do" ORDER BY Rank ASC` and take the first issue's key (if empty, stop and report).

## Steps

1. **Fetch the ticket** — `getJiraIssue` for the ticket key. Read description, comments, formal `Blocks` links, and prose `"Depends on <KEY>"` references in full.
2. **Check readiness** — if an open product/business decision blocks design, stop and ask the user rather than guessing.
3. **Move to In Progress** — look up `"In Progress"` dynamically via `getTransitionsForJiraIssue` (never hardcode transition IDs) and call `transitionJiraIssue`.
4. **Design the change** — read actual target modules (never trust stale file:line citations blindly). Follow `CLAUDE.md`, `.harness/harness.env`, `harness.config.json`, and existing repository conventions: minimal footprint, Clean/Hexagonal domain-core purity, no unrelated refactors.
5. **Implement** — apply the production code changes following the 5-stage `solid-code-synthesizer` pipeline.
6. **Write/update tests** — target **100% branch coverage** on touched modules/types (happy paths, guard clauses, boundary cases, deterministic fake clock, async cancellation, and error translation). Include at least one test that fails without the change.
7. **Run Deterministic Oracles & Unit Tests** — run:
   - `python3 scripts/verify-solid-contracts.py --target .`
   - `./scripts/verify-agent-worktree.sh .`
   - `UNIT_TEST_CMD` from `.harness/harness.env`
   Fix any failures in source (zero linter/compiler suppressions) before proceeding.
8. **Update referenced design docs** (if the ticket explicitly cites one) with a surgical edit.
9. **Move to In Review** — transition the ticket to `"In Review"` (never `"Done"` — only a human reviewer transitions to Done).
10. **Audit the diff** — `git status` / `git diff --stat`. Confirm every touched file belongs to this ticket. Leave all files unstaged (`git add` and `git commit` are strictly forbidden in `/implement-ticket`).
11. **Draft commit-granularity plan** — recommend single vs. split logical commits (e.g., schema/model before logic, docs separate from code; never split production code from its tests) using `<type>(<scope>): <summary> (<TICKET-KEY>)`.
12. **Append Jira resolution note** — `editJiraIssue` appending `## Resolution` (summary, test counts/Oracle status, drafted commit plan, noted as uncommitted pending human review).
13. **Report back** — concise summary, drafted commit message(s), ticket status (`In Review`), and confirmation that zero files were staged, committed, or pushed.
