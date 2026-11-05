---
name: observability-conventions
description: >-
  Language- and vendor-agnostic distributed tracing, structured logging,
  metrics, and SRE alerting conventions — W3C context propagation, log/trace
  correlation, high-cardinality telemetry, OpenTelemetry/OTLP decoupling,
  SLO burn-rate alerting, and tail-based sampling. Use when writing or
  reviewing code that emits logs, traces, or metrics, crosses HTTP/RPC/queue
  boundaries, or configures telemetry and alerts.
---

# Observability Conventions (Language- & Vendor-Agnostic)

Distilled, lazy-loaded OpenTelemetry and SRE observability directives applicable to any programming stack. Read only the reference file relevant to the current task — never load all reference files speculatively.

## References

| File | Topic | Status |
|---|---|---|
| [context-propagation-and-causality.md](references/context-propagation-and-causality.md) | W3C `traceparent`/`tracestate` invariance across threads, async tasks, HTTP/RPC, and message brokers | `current` |
| [unified-correlation-of-pillars.md](references/unified-correlation-of-pillars.md) | Ambient/MDC injection of `trace_id`, `span_id`, `service.name`, and `deployment.environment` on every log entry | `current` |
| [high-cardinality-structured-telemetry.md](references/high-cardinality-structured-telemetry.md) | High-cardinality domain attributes (`user_id`, `tenant_id`, `order_id`) and structured key-value logging (zero string concatenation) | `current` |
| [semantic-vendor-agnostic-instrumentation.md](references/semantic-vendor-agnostic-instrumentation.md) | OpenTelemetry API + OTLP wire protocol over proprietary vendor SDKs in application code | `current` |
| [slo-based-alerting.md](references/slo-based-alerting.md) | Four golden signals, customer-symptom SLOs, and Error Budget Burn-Rate alerting | `current` |
| [tail-based-sampling.md](references/tail-based-sampling.md) | Collector-buffered tail sampling retaining 100% of errors and P95+ latency plus a representative baseline | `current` |
| [activitysource-native-otel-and-log-correlation.md](references/activitysource-native-otel-and-log-correlation.md) | Native `ActivitySource`/`Activity` ↔ OTel concept mapping, zero-cost-when-unsampled pattern, and log correlation | `current` |
