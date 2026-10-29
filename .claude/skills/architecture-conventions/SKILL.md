---
name: architecture-conventions
description: >-
  Language-agnostic software architecture, Clean/Hexagonal/DDD boundaries,
  SOLID and GoF patterns, DI lifetimes, async cancellation and clock
  abstraction, boundary error translation, and contract testing conventions. Use
  when designing, writing, or reviewing code in any programming language.
---

# Architecture & Engineering Conventions (Language-Agnostic)

Distilled, lazy-loaded engineering guidance across any programming stack configured in [`.harness/harness.env`](../../../.harness/harness.env). Read only the reference file relevant to the current task — never load all reference files speculatively.

## References

| File | Topic | Status |
|---|---|---|
| [clean-and-hexagonal-architecture.md](references/clean-and-hexagonal-architecture.md) | Bounded Contexts, Entities vs. Value Objects, Aggregates, Clean/Hexagonal/Onion dependency rules | `current` |
| [solid-and-design-patterns.md](references/solid-and-design-patterns.md) | SOLID guardrails, Strategy/Decorator/Factory/Builder/Command/PubSub, DI lifetimes & captive-dependency prevention | `current` |
| [async-cancellation-and-clock-abstraction.md](references/async-cancellation-and-clock-abstraction.md) | Injected Clock/TimeProvider over raw system wall-clock, end-to-end cancellation propagation, zero sync-over-async | `current` |
| [error-handling-and-boundary-translation.md](references/error-handling-and-boundary-translation.md) | Option/Nullable for absence, Result/Validator for inline branching, bidirectional HTTP/RPC error translation for LSP parity | `current` |
| [testing-strategy-and-contract-suites.md](references/testing-strategy-and-contract-suites.md) | 100% branch coverage, Test Data Builders, shared abstract LSP Contract Test Suites, API seam tests, code-quality metrics | `current` |
