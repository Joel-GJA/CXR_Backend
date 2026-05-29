# Harsha — Phase 3 Responsibilities: Telemetry & Observability + Validation & Diagnostics

## Track B: Telemetry & Observability + Track E: Validation & Diagnostics

H should own the complete **Observability and Validation** layer — from the shared RuntimeEvent contract through telemetry emission and Prometheus metrics to validation scenes and acceptance workflows.

This builds on H's Phase 2 validation and diagnostics work. Phase 2 established validation scenes and runtime diagnostics. Phase 3 expands that into a full observability stack (telemetry + metrics + dashboards) while maturing the validation infrastructure into repeatable, automated workflows.

---

## H's Final Deliverable

By the end of Phase 3:
- a shared `RuntimeEvent` contract is defined and used by all runtime systems,
- Unity runtime emits events without knowing about databases or dashboards,
- a Prometheus-compatible metrics endpoint exposes room/player/session state,
- a starter Grafana dashboard visualizes key metrics,
- a canonical validation scene exists with 5 zones covering all subsystems,
- automated editor tests pass for pure logic,
- manual playtest scripts exist for multiplayer/runtime behavior,
- an acceptance checklist and bug reproduction templates are documented.

---

## Track B: Telemetry & Observability

### 1. RuntimeEvent Contract

H should lead the definition of the shared event contract. Events:

| Event | Source | Payload |
|-------|--------|---------|
| `RoomCreated` | Registry | roomId, timestamp |
| `RoomClosed` | Registry | roomId, timestamp |
| `RoomStarted` | Unity Room | roomId, port, scene |
| `RoomStopped` | Unity Room | roomId, reason |
| `PlayerJoined` | Unity Room | playerId, roomId |
| `PlayerLeft` | Unity Room | playerId, roomId |
| `OwnershipAcquired` | Interactable | objectId, playerId |
| `OwnershipReleased` | Interactable | objectId, playerId |
| `OwnershipTransferred` | Interactable | objectId, fromPlayer, toPlayer |
| `CalibrationStarted` | MR Manager | sessionId, markerId |
| `CalibrationCompleted` | MR Manager | sessionId, markerId, success |
| `SessionStarted` | Unity Room | sessionId, roomId |
| `SessionEnded` | Unity Room | sessionId, reason |
| `ServerStarted` | Host Manager | processId, port |
| `ServerStopped` | Host Manager | processId, exitCode |

The contract format should be a simple serializable C# struct/class in Unity and a matching JSON schema for backend consumption.

### 2. Unity-Side Event Emitter

H should create a lightweight **RuntimeEventEmitter** (singleton or static) that:

- runtime systems call without knowing about Prometheus, databases, or dashboards,
- accepts `RuntimeEvent` objects and broadcasts them,
- supports multiple consumers (local metrics, file export, HTTP forwarding),
- is non-blocking — events are fire-and-forget.

### 3. Local Metrics Exporter

H should build a local metrics exporter that:

- tracks active rooms, player count, session state, uptime, latency/ping,
- tracks ownership events and errors per subsystem,
- exposes a `GET /metrics` Prometheus-compatible endpoint,
- can run embedded in the Unity room or as a sidecar.

### 4. Starter Grafana Dashboard

H should provide a starter Grafana dashboard JSON with panels for:

- active rooms and players (time series),
- session start/stop events,
- ownership transfer frequency,
- calibration success/failure rate,
- system health (uptime, errors).

---

## Track E: Validation & Diagnostics

### 5. Canonical Validation Scene

H should maintain one canonical validation scene (`Phase3ValidationScene`) with separate zones:

| Zone | What It Validates | Owner of Subsystem |
|------|-------------------|-------------------|
| XR Sync Zone | Head/controller transform sync, spawn/despawn | J |
| Interaction Zone | Grab/release, ownership transfer, multi-user interaction | N |
| Lifecycle Zone | Join/leave, reconnect, room cleanup | A |
| MR Calibration Zone | Marker detection, shared origin, calibration flow | J |
| Diagnostics Zone | RuntimeEvent emission, metrics endpoint, debug overlay | H |

### 6. Automated Editor Tests

H should write and maintain NUnit editor tests for:

- RuntimeEvent contract serialization/deserialization,
- MRCalibrationManager state machine transitions,
- Host Manager API endpoint responses (via mock),
- event writer buffer/flush logic,
- metrics calculation accuracy.

Manual playtest scripts should cover:
- two-client sync validation,
- ownership transfer under load,
- host-managed room restart,
- persistence readback.

### 7. Bug Reproduction Templates

H should create templates for:
- synchronization desync bug report (steps, expected, actual, logs),
- ownership failure bug report,
- calibration failure bug report,
- Host Manager process crash report.

### 8. Acceptance Checklist

H should define the Phase 3 acceptance checklist:

- [ ] All 15 RuntimeEvents emit correctly
- [ ] Prometheus endpoint returns valid metrics
- [ ] Grafana dashboard shows live data
- [ ] Persistence writes without blocking gameplay
- [ ] Host Manager starts/stops/restarts services
- [ ] Dashboard displays services, rooms, logs, health
- [ ] MR calibration works across 2+ headsets
- [ ] Validation scene passes all zone tests
- [ ] Editor tests pass
- [ ] One full Windows local multi-room run passes
- [ ] One full Linux headless server run passes

---

## What H Should NOT Touch

| Area | Owner |
|------|-------|
| MR calibration implementation | J |
| XR rig synchronization internals | J |
| Interaction/ownership internals | N |
| PostgreSQL schema & event writer | N |
| Host Manager process APIs | A |
| Dashboard UI pages | A |

H validates these subsystems but does NOT implement their internals.

---

## Practical Implementation Sequence

### STEP 1
Define the `RuntimeEvent` contract. Review with J, N, A. Freeze and publish.

### STEP 2
Build `RuntimeEventEmitter` in Unity. Wire into J's XR rig, N's interactables, A's deployment hooks.

### STEP 3
Build local metrics exporter with Prometheus endpoint.

### STEP 4
Create starter Grafana dashboard.

### STEP 5
Build canonical validation scene with 5 zones. Integrate J, N, A subsystems.

### STEP 6
Write automated editor tests and manual playtest scripts.

### STEP 7
Create bug reproduction templates and acceptance checklist.

### STEP 8
Run full Phase 3 integration validation. Sign off.

---

## Final Ownership Boundary

```
Runtime Systems (J, N, A)
        ↓ (emit)
RuntimeEvent Contract (H defines)
        ↓
RuntimeEventEmitter (H builds)
        ↓
Local Metrics Exporter + Prometheus
        ↓
Grafana Dashboard
        ──── and ────
Validation Scene + Editor Tests + Acceptance Checklist
```

That subsystem is:
- vertically sliced,
- self-contained,
- low-dependency,
- architecturally clean.
