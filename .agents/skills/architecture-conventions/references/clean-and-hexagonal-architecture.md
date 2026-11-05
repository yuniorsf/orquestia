# Clean, Hexagonal & Domain-Driven Architecture

**Status: `current`** — language-agnostic architectural conventions enforced by `harness.config.json` and `scripts/verify-solid-contracts.py`.

## 1. Inward-Only Dependency Rule

Organize source trees so dependency arrows point strictly inward toward the pure domain core (`src/core/` or `src/domain/`):

- **Pure Domain Core (`domainCoreDirs`)**:
  - Owns Entities, Value Objects, Domain Events, Aggregate invariants, and narrow Port interfaces/protocols/traits.
  - **Zero outward dependencies**: never import ORMs, SQL drivers, HTTP clients, message brokers, cloud SDKs, or UI frameworks.
- **Application / Use-Case Layer**:
  - Coordinates domain objects and port calls, transaction boundaries, authorization checks, and telemetry spans without coupling to concrete storage or transport vendors.
- **Adapters & Infrastructure (`src/adapters/`, `src/infra/`, `src/apps/`)**:
  - Implement core ports (SQL/NoSQL repositories, REST/gRPC controllers and clients, Kafka/ServiceBus/RabbitMQ publishers & consumers, CLI/Web/Mobile UI).

## 2. Entities vs. Value Objects

- **Value Objects** (defined entirely by attributes, zero lifecycle identity): make them **deeply immutable** (`@dataclass(frozen=True)`, `Readonly<T>`, Rust/Go value structs, C# `readonly record struct` / `sealed record`, Kotlin `data class`) and validate invariants on construction.
- **Entities & Aggregates** (persistent identity across state transitions): mutate state only through explicit domain methods that enforce invariants atomically rather than exposing unrestricted public field mutation.

## 3. Bounded Context Isolation

Keep independent domain verticals decoupled as separate connected components. Cross-context interaction happens strictly through published contracts (events or narrow API projections), verified automatically via architecture tests (`ARCH_TEST_CMD`).
