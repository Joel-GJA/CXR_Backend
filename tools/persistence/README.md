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

Rooms opened on a given day:

```sql
SELECT room_id, room_name, created_at, closed_at
FROM rooms
WHERE created_at::date = '2026-05-29'
ORDER BY created_at;
```

Participant timeline for a session:

```sql
SELECT joined_at, left_at, participant_net_id, connection_id
FROM participants
WHERE session_id = '<session-uuid>'
ORDER BY joined_at;
```

Event counts by type (last 24h) — powers the dashboard charts:

```sql
SELECT event_type, COUNT(*) AS n
FROM runtime_events
WHERE occurred_at > NOW() - INTERVAL '24 hours'
GROUP BY event_type
ORDER BY n DESC;
```

## Replay Tool

`replay.js` reads stored events and prints a human-readable session timeline.
It uses PostgreSQL when `DATABASE_URL` is set (and `pg` is installed), otherwise
it falls back to the append-only JSONL file the writer produces.

```bash
node tools/persistence/replay.js                        # list recent rooms + sessions
node tools/persistence/replay.js --room room-ab12cd     # timeline for one room
node tools/persistence/replay.js --session <uuid>       # timeline for one session
node tools/persistence/replay.js --type PlayerJoined    # filter by event type
node tools/persistence/replay.js --file ./events.jsonl  # force a JSONL source
node tools/persistence/replay.js --limit 500            # cap rows (default 200)
```

Output is colorized: green = created/started/joined, red = closed/stopped/left,
yellow = ownership-transfer/calibration.

## Local DB Setup

1. Install PostgreSQL 15+ (or run the panel's bundled stack: `cd panel && docker compose up -d db`).
2. Create the schema:
   ```bash
   psql "$DATABASE_URL" -f tools/persistence/schema.sql
   ```
3. Point the panel/writer at it:
   ```bash
   export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/cxr"
   ```
   The event writer auto-selects its backend in this order: **Supabase**
   (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`) → **PostgreSQL** (`DATABASE_URL`)
   → **JSONL** file (zero-config fallback).

## Writer Configuration

| Env var | Default | Meaning |
|---------|---------|---------|
| `DATABASE_URL` | — | PostgreSQL connection string (enables PG backend) |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | — | Supabase backend (takes priority) |
| `EVENTS_JSONL_PATH` | `panel/server/data/events.jsonl` | JSONL fallback location |
| `FLUSH_INTERVAL_MS` | `2000` | How often buffered events flush to the backend |
| `MAX_BATCH_SIZE` | `100` | Max events per write batch |

Writes are **asynchronous and append-first** — gameplay never blocks on a write,
and a backend outage degrades gracefully to the JSONL buffer.

## Grafana Datasource (direct PostgreSQL)

You can chart session history directly from PostgreSQL in Grafana (separate from
the Prometheus metrics in `tools/observability/`):

1. Grafana → Connections → Add data source → **PostgreSQL**.
2. Host `localhost:5432`, database `cxr`, user/password as configured, SSL `disable` for local.
3. Example panel query (players over time):
   ```sql
   SELECT occurred_at AS "time",
          COUNT(*) FILTER (WHERE event_type = 'PlayerJoined')
        - COUNT(*) FILTER (WHERE event_type = 'PlayerLeft') AS net_join_delta
   FROM runtime_events
   WHERE $__timeFilter(occurred_at)
   GROUP BY occurred_at
   ORDER BY occurred_at;
   ```

## Troubleshooting

| Symptom | Cause / Fix |
|---------|-------------|
| Events not in DB, only in JSONL | `DATABASE_URL` unset or `pg` not installed in `panel/server`. Run `npm install` there. |
| `replay.js` says "no JSONL event file" | No events generated yet, or wrong path. Pass `--file <path>` or generate events via the panel. |
| `relation "runtime_events" does not exist` | Schema not migrated. Run the `psql ... -f schema.sql` step. |
| Writes lag / batch too large | Lower `FLUSH_INTERVAL_MS` or `MAX_BATCH_SIZE`. |
| Duplicate `event_id` errors | `runtime_events.event_id` is the primary key — the emitter must send unique IDs. |
