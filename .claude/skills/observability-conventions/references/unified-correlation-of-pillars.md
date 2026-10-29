# Unified Correlation of Logs, Metrics & Traces

**Status: `current`** — universal observability correlation standard.

## 1. Mandatory Ambient Metadata on Every Log Record

Every structured log record emitted while a span is active must automatically carry:
- `trace_id`
- `span_id`
- `service.name`
- `deployment.environment` (or `env`)

Configure this once via ambient logging bridges (OpenTelemetry log appenders/bridges, MDC, `structlog`/`pino`/`tracing`/`ILogger` context processors) so application code never threads trace IDs manually through business signatures.

## 2. $O(1)$ Incident Pivot

Injecting `trace_id` and `span_id` on every log record turns root-cause lookup from an expensive full-text scan over millions of log lines into an $O(1)$ indexed jump between an anomalous log record, its full distributed trace waterfall, and correlated service resource metrics. Never bypass the structured logger with raw `print` / `console.log` / `fmt.Println` calls in production services.
