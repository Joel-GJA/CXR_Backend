# Phase 3 — Acceptance Checklist

The Phase 3 sign-off gate. A track is **not** complete until every box in its
section passes on a clean build. Record the build/commit, date, and operator
for each run.

> Run record:
> - Commit: `__________`  Date: `__________`  Operator: `__________`

---

## Track B — Telemetry & Observability (H)

- [ ] All 15 `RuntimeEvent` types emit correctly from their source subsystems
      (`RoomCreated`, `RoomClosed`, `RoomStarted`, `RoomStopped`, `PlayerJoined`,
      `PlayerLeft`, `OwnershipAcquired`, `OwnershipReleased`, `OwnershipTransferred`,
      `CalibrationStarted`, `CalibrationCompleted`, `SessionStarted`,
      `SessionEnded`, `ServerStarted`, `ServerStopped`).
- [ ] `RuntimeEventEmitter` is fire-and-forget and never blocks the runtime.
- [ ] Panel `/metrics` endpoint returns valid Prometheus exposition text
      (`curl http://<panel>:4000/metrics` shows `# HELP` / `# TYPE` lines).
- [ ] Prometheus target `cxr-panel` shows **UP** in Status → Targets.
- [ ] Grafana dashboard imports cleanly and shows live data on all panels.
- [ ] `cxr_rooms_running` and `sum(cxr_room_players)` track reality during a
      live 2-client session.

## Track C — Persistence (N)

- [ ] Schema migrates cleanly on a fresh PostgreSQL instance (`schema.sql`).
- [ ] Runtime events persist without blocking gameplay (async, append-first).
- [ ] Connection loss falls back to JSONL and recovers without data loss.
- [ ] Session history is queryable (rooms by date, participant timeline,
      interaction sequence).
- [ ] Replay script prints a coherent session timeline from stored events.
- [ ] `cxr_events_total` in `/metrics` matches the row count in the DB.

## Track D — Operations Dashboard & Host Manager (A)

- [ ] Host Manager starts, stops, and restarts services via the API.
- [ ] Dashboard shows services, rooms, logs, and health.
- [ ] Per-service logs stream live over WebSocket and are filterable.
- [ ] Room isolation holds: start 3 rooms, stop 1, restart 1 — the others are
      unaffected (separate ports, working dirs, log files).
- [ ] Stopping a room removes it from the registry immediately.
- [ ] No duplicate-named live rooms can be created.

## Track A — MR Foundation (J) — *deferred to SDK integration*

- [ ] (deferred) Marker detection + calibration workflow in MR validation scene.
- [ ] (deferred) Shared origin aligns across 2+ headsets within tolerance.

## Track E — Validation & Diagnostics (H)

- [ ] `Phase3ValidationScene` exists with all 5 zones (XR Sync, Interaction,
      Lifecycle, MR Calibration, Diagnostics).
- [ ] NUnit editor tests pass: event serialization, calibration state machine,
      host-manager mock responses, event-writer buffer/flush, metrics math.
- [ ] Manual playtest scripts run: 2-client sync, ownership under load,
      host-managed room restart, persistence readback.
- [ ] Bug reproduction templates are in use for any filed defects.

---

## Full-System Integration

- [ ] One full **Windows** local multi-room run passes end-to-end.
- [ ] One full **Linux headless** server run passes end-to-end.
- [ ] Integration demo: MR room → events emitted → persisted → dashboard +
      Grafana display the same reality.

---

## Sign-off

| Track | Owner | Pass | Notes |
|-------|-------|------|-------|
| B — Telemetry | H | ☐ | |
| C — Persistence | N | ☐ | |
| D — Host Manager | A | ☐ | |
| E — Validation | H | ☐ | |
| Integration | All | ☐ | |
