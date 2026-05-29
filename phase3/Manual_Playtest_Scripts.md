# Phase 3 — Manual Playtest Scripts

Repeatable manual test procedures for behavior that automated editor tests can't
cover (live multiplayer, ownership under load, host-managed restarts, persistence
readback). Run these before any Phase 3 sign-off. Pair with
[Phase3_Acceptance_Checklist.md](Phase3_Acceptance_Checklist.md) and file failures
using [Bug_Report_Templates.md](Bug_Report_Templates.md).

**Setup for all scripts**
- Build/commit: record before starting.
- At least one headset or editor host + one client on the same LAN.
- Panel running (`http://<host>:4000`), registry started from the Host Manager page.
- Live Logs page open in a browser tab to watch RuntimeEvents in real time.

---

## Validation Scene Zones (reference)

The canonical `Phase3ValidationScene` has five zones. Each playtest below maps to
one or more zones.

| Zone | Validates | Owner |
|------|-----------|-------|
| XR Sync | Head/controller transform sync, spawn/despawn | J |
| Interaction | Grab/release, ownership transfer, multi-user | N |
| Lifecycle | Join/leave, reconnect, room cleanup | A |
| MR Calibration | Marker detection, shared origin | J (deferred) |
| Diagnostics | RuntimeEvent emission, metrics endpoint, overlay | H |

---

## PT-1 · Two-Client Sync

**Goal:** remote avatar transforms track within ~100 ms; join/leave is clean.

1. Start a room from the panel **Rooms** page (pick a build, capacity 8).
2. Client A joins (headset or editor). Confirm `PlayerJoined` appears in Live Logs.
3. Client B joins. Confirm a second `PlayerJoined`.
4. Move Client A's head/controllers. **Expected:** B sees A move smoothly, < ~100 ms lag, no teleport/jitter.
5. Client B disconnects. **Expected:** `PlayerLeft` emitted; A sees B's avatar despawn within ~2 s.
6. **Pass criteria:** both join events, smooth sync both directions, clean despawn.
   On fail → `[SYNC]` bug report with a screen recording.

---

## PT-2 · Ownership Transfer Under Load

**Goal:** ownership is exclusive and transfers cleanly even with rapid contention.

1. Two clients in one room, one shared interactable in the Interaction zone.
2. Client A grabs the object. **Expected:** `OwnershipAcquired{playerId=A}`; object follows A; B cannot move it.
3. A releases; B immediately grabs. **Expected:** `OwnershipReleased` then `OwnershipAcquired{playerId=B}` (or `OwnershipTransferred`).
4. **Load test:** both clients spam grab/release on the same object ~10× rapidly.
   **Expected:** no double-ownership, object never duplicates or snaps to origin, every transition emits a matching event.
5. **Pass criteria:** ownership always single-holder; event log has no orphaned acquire without a release.
   On fail → `[OWNERSHIP]` bug report.

---

## PT-3 · Host-Managed Room Restart

**Goal:** the Host Manager restarts a room without affecting other rooms (isolation).

1. From the panel, start **3 rooms** (different names — duplicate names are rejected).
2. Confirm 3 `ServerStarted` events and 3 rows in Registry Rooms (all green/ACTIVE).
3. Join Client A to room 1; join Client B to room 2.
4. **Restart room 1** from the panel. **Expected:** room 1 process restarts (restartCount +1), Client A drops and can rejoin; **rooms 2 and 3 are untouched** (B stays connected, no log gap).
5. **Stop room 3.** **Expected:** it disappears from Running Rooms and Registry Rooms immediately.
6. **Pass criteria:** isolation holds (separate ports/dirs/logs), no cross-room impact, registry reflects reality instantly.
   On fail → `[HOSTMGR]` bug report.

---

## PT-4 · Persistence Readback

**Goal:** events emitted during a session are durably stored and replayable.

1. Run a full mini-session: create room → 2 players join → grab/release an object → both leave → stop room.
2. Wait ~3 s for the writer to flush (`FLUSH_INTERVAL_MS`).
3. Read back the timeline:
   ```bash
   node tools/persistence/replay.js --room <room_id>
   ```
   (DB mode if `DATABASE_URL` is set, else JSONL fallback.)
4. **Expected:** the printed timeline contains, in order: `RoomCreated/RoomStarted`,
   two `PlayerJoined`, `OwnershipAcquired`/`OwnershipReleased`, two `PlayerLeft`, `RoomStopped`.
5. Cross-check the metric: `curl http://<host>:4000/metrics | grep cxr_events_total`
   should be ≥ the number of events in this session.
6. **Pass criteria:** no missing events, timeline order matches what you did live,
   gameplay never stalled during the session (persistence is async).
   On fail → note whether events are in JSONL but not the DB (writer/backend issue) vs missing entirely (emitter issue).

---

## Diagnostics Spot-Check (every run)

- `curl http://<host>:4000/metrics` returns valid Prometheus text.
- Grafana dashboard panels show live data (rooms, players, events-by-type).
- Server Status page (`/server`) shows live CPU/memory/disk.
- Live Logs streams stdout/stderr from every running service.
