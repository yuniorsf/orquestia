# Semantic & Vendor-Agnostic Instrumentation (OpenTelemetry + OTLP)

**Status: `current`** — universal telemetry decoupling rule.

## 1. Zero Commercial Telemetry SDKs in Domain or Application Code

Importing proprietary vendor SDKs (Datadog, New Relic, Dynatrace, Sentry proprietary tracing APIs) directly inside domain or application modules creates hard vendor lock-in across every instrumented call site.

## 2. Instrument Against OpenTelemetry APIs, Export via OTLP

- Instrument application code exclusively against standard **OpenTelemetry APIs** (`Tracer`, `Span`, `Meter`, or runtime-native OpenTelemetry primitives) wrapped behind clean internal telemetry helpers where helpful.
- Export all traces, metrics, and logs over the vendor-neutral **OTLP (OpenTelemetry Protocol)** to an out-of-process **OpenTelemetry Collector** (or configurable OTLP endpoint/headers), making backend switches a pure deployment/configuration change.
