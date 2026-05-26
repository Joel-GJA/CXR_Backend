# CXR Persistence

This folder contains the PostgreSQL-first persistence foundation for Phase 3.

## Create Schema

```powershell
psql $env:DATABASE_URL -f tools/persistence/schema.sql
```

The schema is append-first. Unity gameplay should emit events and continue; a bridge or writer process can insert records asynchronously.

## Runtime Event Input

Unity can write JSONL through `RuntimeEventFileSink`:

```text
Application.persistentDataPath/cxr_runtime_events.jsonl
```

Each line is a serialized `RuntimeEvent`. The future writer service should read this file or receive the same payload over HTTP, insert into `runtime_events`, and optionally fan out specific event types into `interaction_events` and `calibration_events`.

## Query Examples

Recent runtime events:

```sql
SELECT occurred_at, event_type, source, participant_net_id, entity_net_id, message
FROM runtime_events
ORDER BY occurred_at DESC
LIMIT 50;
```

Interactions for one object:

```sql
SELECT occurred_at, action, participant_net_id, entity_net_id
FROM interaction_events
WHERE entity_net_id = 1001
ORDER BY occurred_at;
```
