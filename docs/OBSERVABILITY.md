# Observability Plan

## Implemented
- JSON-style startup/shutdown and error logs.
- `x-request-id` response header and request ID in error payloads.
- `/health/live` and `/health/ready` probes.
- PostgreSQL pool error logging without query parameters.

## Production rollout
1. Add `prom-client` counters/histograms: request count, status code, route template, latency; avoid high-cardinality labels such as user ID.
2. Export metrics to Prometheus and dashboard in Grafana.
3. Add OpenTelemetry Express and `pg` instrumentation; export OTLP traces.
4. Propagate trace/request IDs into worker jobs.
5. Alert on p95 latency >200 ms reads / >500 ms writes, 5xx ratio, DB pool saturation, lock wait, failed backups and availability budget burn.
6. Define retention and redact personal/health data from logs.

Metrics/tracing exporters are documented but not wired into this starter; the assignment's observability requirement should not be represented as fully complete until implemented and demonstrated.
