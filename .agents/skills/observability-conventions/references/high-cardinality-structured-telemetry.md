# High-Cardinality Structured Telemetry

**Status: `current`** — universal structured-logging and span-attribution standard.

## 1. Attach High-Cardinality Domain Identifiers to Spans & Structured Logs

Premature write-time aggregation discards the exact dimensions needed to answer *"whose request failed and why?"* Attach domain identifiers (`user_id`, `tenant_id`, `order_id`, `project_id`, `batch_size`) as structured span attributes and structured log fields (while keeping high-cardinality IDs **out** of Prometheus/OTel metric label sets where cardinality bounds apply).

## 2. Never Interpolate Variables into Opaque Log Strings

Never concatenate dynamic values into log message templates:

- **Wrong**: `logger.info(f"Order {order_id} failed for tenant {tenant_id}")` / ``logger.info(`Order ${orderId} failed`)``
- **Right**: Emit a constant message event/template plus distinct, indexable key-value fields (`logger.info("order_settlement_failed", order_id=order_id, tenant_id=tenant_id)` or message templates `{OrderId}`, `{TenantId}`).
