# Nareen — Phase 3 Responsibilities: Persistence

## Track C: Persistence

N should own the complete **Persistence pipeline** — from event record ingestion through database schema to replay/query tooling.

This builds on N's Phase 2 interaction and ownership work. The networked interactables generate interaction events (grab, release, ownership transfer) that are the primary data source for persistence. N ensures those events are durably stored without affecting realtime gameplay.

---

## N's Final Deliverable

By the end of Phase 3:
- runtime events persist to PostgreSQL without blocking gameplay,
- session history can be queried and replayed,
- the persistence layer is append-first and invisible to realtime sync,
- a local DB setup guide enables new deployments.

---

## Specifically What N Should Build

### 1. PostgreSQL Schema

N should define and migrate the persistence schema with these tables:

| Table | Purpose |
|-------|---------|
| `rooms` | Room registry records, start/stop timestamps |
| `sessions` | Play sessions per room, participant count |
| `participants` | Networked participants per session, join/leave times |
| `runtime_events` | Canonical event table with JSONB metadata |
| `interaction_events` | Specific interaction actions (grab, release, transfer) |
| `calibration_events` | MR calibration state transitions |

Design principles:
- append-first (no UPDATE on event tables),
- indexed by room_id + timestamp for fast queries,
- JSONB for extensible event metadata,
- timestamps in UTC.

### 2. Event Writer Service

N should build a lightweight **event writer** that:

- reads `RuntimeEvent` objects (from the shared contract H defines),
- batches events for efficient writes,
- writes asynchronously so realtime gameplay never blocks,
- handles connection failures gracefully (local buffer, retry, fallback to JSONL file).

Delivery mechanisms:
- HTTP endpoint receiving JSON event batches,
- OR JSONL file watcher for air-gapped / offline scenarios.

### 3. Local DB Setup & Documentation

N should document:
- PostgreSQL installation and schema migration steps,
- connection configuration for Unity room and Host Manager,
- event writer configuration (flush interval, batch size, retry policy),
- troubleshooting common persistence issues.

### 4. Replay / Query Examples

N should provide:
- example SQL queries for session history (rooms by date, participant timeline, interaction sequence),
- a simple replay script that reads stored events and prints a session timeline,
- Grafana dashboard datasource example (PostgreSQL direct query).

---

## What N Should NOT Touch

| Area | Owner |
|------|-------|
| RuntimeEvent contract design | H (N reviews) |
| Marker detection & MR calibration | J |
| Telemetry emitter & Prometheus | H |
| Host Manager process APIs | A |
| Dashboard UI pages | A |
| XR rig synchronization | J |
| Validation scenes (non-persistence) | H |

---

## Practical Implementation Sequence

### STEP 1
Design and document the PostgreSQL schema. Review with team.

### STEP 2
Create the migration SQL script and test against a local PostgreSQL instance.

### STEP 3
Build the event writer service (HTTP + JSONL fallback).

### STEP 4
Integrate event writer with the `RuntimeEvent` contract. Verify events flow from Unity → writer → DB.

### STEP 5
Write example replay/query scripts and test with real session data.

### STEP 6
Document local DB setup, configuration, and troubleshooting.

---

## Final Ownership Boundary

```
RuntimeEvent objects (from Unity runtime)
        ↓
Event Writer Service (buffered, async)
        ↓
PostgreSQL (append-first tables)
        ↓
Query / Replay Scripts
```

That subsystem is:
- vertically sliced,
- self-contained,
- low-dependency,
- architecturally clean.
