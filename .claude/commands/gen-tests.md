Generate automated unit tests targeting 100% branch coverage for the type, class, or module named: `$ARGUMENTS`

## Steps

1. **Locate target source** — search the codebase for the class, struct, record, trait, or module matching `$ARGUMENTS` and read it in full alongside `.harness/harness.env` (`STACK_PROFILE`, `UNIT_TEST_CMD`).
2. **Discover test conventions** — inspect `tests/` (or sibling `*.test.*` / `*_test.*` files) to match the project's exact test runner, assertion style, mocking/faking pattern, and naming convention (`<Target>_<Scenario>_<ExpectedOutcome>`).
3. **Exhaustive 100%-Branch Analysis** — enumerate every public/exported function and trace:
   - All conditional branches (`if`/`else`, `switch`/`match` arms, ternary, null-coalescing/optional-chaining)
   - Guard clauses and early returns
   - Expected absence (`null`/`None`/`Option::None`) vs. error/exception paths
   - Boundary inputs (empty, single-element, max-size, zero/negative values)
   - Deterministic fake Clock advances and async cancellation signals/tokens
   - Emitted domain events or state transitions
4. **Generate the test suite**:
   - Mirror the source module hierarchy under the project's test directory.
   - Follow Arrange / Act / Assert structure with independent, order-agnostic tests.
   - Mock only narrow external port interfaces — never touch live databases, filesystems, or networks in unit tests.
   - Use parameterized/table-driven tests (`@pytest.mark.parametrize`, `it.each`, Go table tests, `[Theory]`, `#[rstest]`) for boundary permutations.
5. **Verify execution** — run `UNIT_TEST_CMD` (or targeted test filter) and `python3 scripts/verify-solid-contracts.py --target .` to confirm all generated tests compile and pass without linter/typechecker suppressions.
6. **Coverage checklist** — summarize every method/branch covered and flag any unreachable dead code discovered.
