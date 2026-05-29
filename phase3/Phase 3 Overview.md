# Phase 3 Overview — Parallel Tracks & Ownership

## Phase Objective

Phase 3 builds on the stabilized multiplayer foundation from Phase 2 and expands into five parallel tracks:

1. **Track A — MR Foundation** (J)
2. **Track B — Telemetry & Observability** (H)
3. **Track C — Persistence** (N)
4. **Track D — Operations Dashboard & Host Manager** (A)
5. **Track E — Validation & Diagnostics** (H)

The strategy is: create one shared `RuntimeEvent` contract first, then let all tracks proceed in parallel without coupling runtime sync code to backend/ops systems.

---

## Intern Ownership Summary

| Intern | Phase 2 Ownership | Phase 3 Tracks | Key Expansion |
|--------|-------------------|----------------|---------------|
| **J (Joel)** | XR Presence Pipeline | **Track A: MR Foundation** | Marker-based shared-origin alignment, calibration manager, MR validation scene |
| **N (Nareen)** | Interaction & Ownership Pipeline | **Track C: Persistence** | PostgreSQL schema, event writer service, replay/query for session history |
| **A (Ashis)** | Deployment & Operations Pipeline | **Track D: Operations Dashboard & Host Manager** | Node.js Host Manager API, service templates, dashboard pages, log streaming |
| **H (Harsha)** | Validation & Diagnostics Pipeline | **Track B + Track E: Telemetry & Observability + Validation & Diagnostics** | RuntimeEvent contract, telemetry emitter, Prometheus/Grafana integration, validation scene, automated tests, acceptance checklists |

---

## First: Shared Event Contract (Cross-Cutting, All Interns)

Before parallel tracks begin, the team defines a single `RuntimeEvent` contract that all runtime systems emit and all backend systems consume.

Events: `RoomCreated`, `RoomClosed`, `RoomStarted`, `RoomStopped`, `PlayerJoined`, `PlayerLeft`, `OwnershipAcquired`, `OwnershipReleased`, `OwnershipTransferred`, `CalibrationStarted`, `CalibrationCompleted`, `SessionStarted`, `SessionEnded`, `ServerStarted`, `ServerStopped`.

**H** leads the contract definition. **J, N, A** review and approve from their subsystem's perspective. Once approved, tracks proceed independently.

---

## Public Interfaces & Contracts

| Interface | Owned By | Consumed By |
|-----------|----------|-------------|
| `RuntimeEvent` contract | H | H, N, A |
| `MRCalibrationManager` | J | J, H |
| Host Manager API (`/services/*`) | A | A, H |
| `XRMultiplayerRuntimeFacade` | J | All (existing) |
| `RuntimeInteractable` | N (Phase 2) | N, H |

---

## Integration & Milestones

| Milestone | Criteria | Trigger |
|-----------|----------|---------|
| Event Contract Approved | All 15 events defined, all interns sign off | Start of Phase 3 |
| Track A Milestone | Marker detection + calibration workflow working in MR validation scene | J complete |
| Track B Milestone | RuntimeEvent emitter active + Prometheus endpoint returning metrics | H complete |
| Track C Milestone | Schema migrated, event records persisting without blocking runtime | N complete |
| Track D Milestone | Host Manager starts/stops services, dashboard shows rooms + logs | A complete |
| Track E Milestone | Validation scene with 5 zones, automated tests passing | H complete |
| Phase 3 Integration | All tracks demo together: MR room → events emitted → persisted → dashboard displays | All |

---

## Critical Architecture Rules

1. **No realtime dependency on database writes.** Persistence is append-first and asynchronous.
2. **Host Manager does not understand gameplay.** It manages processes only — no rooms, players, or Mirror state.
3. **Telemetry emitter knows nothing about Prometheus/Grafana.** It only emits `RuntimeEvent` objects.
4. **MR calibration is independent of cloud anchors.** Marker-only (ArUco/AprilTag).
5. **Validation tests validate, not implement.** H validates J/N/A subsystems, does not own their internals.
