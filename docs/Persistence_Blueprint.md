# Persistence Blueprint

Persistence is append-first. Runtime gameplay must continue even if the database is unavailable.

The first supported store is PostgreSQL. The schema lives at:

`tools/persistence/schema.sql`

## Tables

- `rooms`
- `sessions`
- `participants`
- `runtime_events`
- `interaction_events`
- `calibration_events`

## Write Path

1. Unity emits `RuntimeEvent`.
2. A bridge/exporter forwards events out of process.
3. A writer service inserts records into PostgreSQL.
4. Dashboards and reports query the database later.

This keeps database latency out of Mirror object authority, XR rig sync, and physics handoff.

## Deferred

OpenSearch and InfluxDB are optional later additions. PostgreSQL is enough for session history, interaction auditing, calibration records, and dashboard queries.
