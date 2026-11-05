# Symptom-Based SLO & Error-Budget Burn-Rate Alerting

**Status: `current`** — universal SRE alerting discipline.

## 1. Alert on Customer-Facing Symptoms, Not Raw Resource Gauges

Raw host/container threshold alerts (e.g., `"CPU > 85%"`) cause alert fatigue because resource utilization is a potential internal cause rather than proof of user pain. Anchor paging alerts on the **Four Golden Signals** impacting user-visible **Service Level Objectives (SLOs)**:

1. **Latency** (tail response duration, P95 / P99)
2. **Traffic** (request / event throughput)
3. **Errors** (failed request ratio)
4. **Saturation** (queue depth / pool exhaustion approaching capacity limits)

## 2. Multi-Window Error-Budget Burn Rate

Trigger urgent alerts based on **Error Budget Burn Rate** — paging only when current failure velocity would consume a critical fraction of the 30-day error budget within hours — separating genuine customer-impacting incidents from brief, self-resolving background noise.
