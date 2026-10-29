# Context Invariance & Causal Propagation

**Status: `current`** — universal distributed-tracing practice across all runtimes.

## 1. Preserve the Trace DAG Across Every Boundary

Distributed tracing relies on an unbroken Directed Acyclic Graph (DAG) of spans sharing a single `TraceId`. Dropping context across a worker thread, async task, or message queue silently starts a disconnected root trace and destroys post-incident causal reconstruction.

## 2. Deterministic Async & Messaging Propagation

- **In-Process**: Every spawned thread, goroutine, async task, or worker pool job must inherit the active span context explicitly or via runtime context propagation (`context.Context`, `AsyncLocal`, `ContextVar`, `AsyncLocalStorage`).
- **Async Message Brokers (Kafka, RabbitMQ, SQS, Service Bus)**:
  - **Producer**: Start a `PRODUCER` span and inject W3C `traceparent` / `tracestate` into message headers.
  - **Consumer**: Extract `traceparent` / `tracestate` from message headers and parent the `CONSUMER` span (or span link for batch consumers) to the extracted context.

## 3. Standardize on W3C Trace Context

Always propagate `traceparent` and `tracestate` headers (W3C Trace Context specification) rather than bespoke `X-Correlation-Id` headers so trace continuity survives polyglot services and telemetry backend migrations without code changes.
