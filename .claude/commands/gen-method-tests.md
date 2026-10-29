Generate automated unit tests targeting 100% branch coverage for a single function or method. Argument format: `TypeOrModule/FunctionName` or `TypeOrModule.FunctionName`.

Parse `$ARGUMENTS` into **Target** (before `/` or `.`) and **FunctionName** (after `/` or `.`).

## Steps

1. **Read full context** — locate `Target`, inspect its constructor/injected ports, state fields, and all overloads/signatures of `FunctionName`, and check `.harness/harness.env` for the active test runner.
2. **Match existing test conventions** — inspect existing tests for `Target` (runner, assertion style, mock/fake patterns, `FunctionName_Condition_ExpectedResult` naming).
3. **Trace 100% of execution paths in `FunctionName`**:
   - Every `if`/`else` and `switch`/`match` arm (including fallback/default)
   - Null/Optional coalescing and short-circuit boolean branches
   - Guard clauses, validation failures, and thrown/returned domain errors
   - Loop boundaries (`0`, `1`, `N` elements)
   - Async happy path, faulted dependency path, deterministic Clock advance, and cancellation token/signal abort
4. **Emit or extend tests**:
   - If a test file for `Target` already exists, append/insert only the new test cases cleanly; otherwise scaffold the complete test file.
   - Use parameterized/table-driven test cases for boundary matrices and mock only narrow port abstractions (zero live I/O).
5. **Run & verify** — execute the targeted test command and `python3 scripts/verify-solid-contracts.py --target .` to confirm 100% green execution with zero linter/compiler suppressions, then output a branch-by-branch coverage checklist.
