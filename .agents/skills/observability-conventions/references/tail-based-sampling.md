# Cost Optimization via Collector Tail-Based Sampling

**Status: `current`** — universal trace-retention architecture.

## 1. Why Head-Based Sampling Misses Critical Incidents

Head-based probabilistic sampling decides whether to keep or drop a trace at root-span creation time — *before* knowing whether a downstream span threw an error or hit a P99 latency spike.

## 2. Tail-Based Sampling Policy at the OpenTelemetry Collector

Configure applications to emit full spans to a local/cluster **OpenTelemetry Collector** running the `tail_sampling` processor, which buffers complete traces briefly and retains:

1. **100% of error traces** (`status_code == ERROR` or recorded exception)
2. **100% of high-latency traces** (duration exceeding P95 / SLO latency threshold)
3. **A small probabilistic baseline (e.g., 1–5%)** of healthy, low-latency traffic for statistical comparison
