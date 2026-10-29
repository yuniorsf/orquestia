# Testing Strategy, Shared Contract Suites & Code Quality Metrics

**Status: `current`** — language-agnostic QA and maintainability discipline.

## 1. 100% Branch Coverage on Touched Logic

Target **100% branch coverage** across modified domain and adapter modules:
- Cover every `if`/`else`, `switch`/`match` arm, null/optional coalescing branch, guard clause, boundary value (`0`, `1`, `N`), fake-clock transition, and cancellation path.
- Include at least one test proven to fail without the production change (non-vacuous test proof) and explicit negative-scope tests for authorization/permission rules.

## 2. Shared Behavioral Contract Suites (Proving LSP)

Whenever an interface/port has multiple implementations (e.g., PostgreSQL/SQLite, In-Memory fake, REST/gRPC client, caching/validating decorator):
- Author **one shared abstract/parameterized Contract Test Suite** asserting every behavioral, concurrency, error, and event invariant of the port.
- Execute that exact suite against **every** concrete implementation (unwrapped and decorated) so Liskov Substitution is continuously verified in CI.

## 3. Closing the Server $\leftrightarrow$ Client Transport Seam

Mocking HTTP responses in client tests *and* testing server handlers separately can leave a drift gap if server error envelopes evolve. Pair REST/RPC client repositories with in-memory transport seam tests routing the real client directly through the real server router/handler pipeline.

## 4. Shared `TestDataBuilders` & Code Metrics

- Promote repetitive multi-field domain test setup into fluent `TestDataBuilders` with sensible defaults so tests specify only the attributes relevant to their scenario.
- Use code metrics as concrete refactoring triggers:
  - **Cyclomatic complexity $< 10$** per function/method (extract polymorphic strategies or lookup tables when exceeded).
  - **Interface size $\le 5$ methods** for role ports (`Reader` vs. `Writer`).
  - **Zero empty `catch`/`except` blocks** and deterministic resource disposal (`using`, `defer`, `with`, `Drop`).
