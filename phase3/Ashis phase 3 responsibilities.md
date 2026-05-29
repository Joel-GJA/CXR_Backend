# Ashis — Phase 3 Responsibilities: Operations Dashboard & Host Manager

## Track D: Operations Dashboard & Host Manager

A should own the complete **Operations control plane** — from the Host Manager's process lifecycle API through service templates to the web dashboard.

This builds directly on A's Phase 2 deployment and operations work. Phase 2 established runtime packaging, room launch scripts, and structured logging. Phase 3 elevates that into a proper control-plane Host Manager with a web dashboard.

---

## A's Final Deliverable

By the end of Phase 3:
- Host Manager can start, stop, restart, and monitor services (room-registry, Unity rooms, dashboard itself),
- logs are captured per-service and streamable via WebSocket,
- a web dashboard displays services, rooms, logs, and health status,
- service templates exist for registry and Unity room.

---

## Specifically What A Should Build

### 1. Host Manager Node.js Service

A should extend the existing `tools/host-manager/server.js` into the canonical Host Manager with these responsibilities:

- **Process lifecycle**: start, stop, restart child processes,
- **Process monitoring**: track PID, CPU, memory, uptime, exit codes,
- **Health reporting**: respond to health checks, report process state,
- **Log aggregation**: capture stdout/stderr per service,
- **Log persistence**: write per-service log files with rotation,
- **Log streaming**: WebSocket endpoint for live log viewing,
- **Telemetry forwarding**: transport metrics from services to dashboard (does not interpret them).

### 2. Host Manager API

```
GET    /services               — list all managed processes
GET    /services/:id            — get process status and metrics
POST   /services                — start a service from a template
DELETE /services/:id            — stop and remove a service
POST   /services/:id/restart    — restart a service
WS     /logs                    — WebSocket stream for all logs
```

The Host Manager does NOT understand rooms, players, Mirror state, or room internals. It only manages service templates and processes.

### 3. Service Templates

A should define reusable service templates:

| Template | Executable | Config |
|----------|-----------|--------|
| `room-registry` | `node server.js` | Port, stale timeout |
| `unity-room` | `UnityRoom.exe` | Room ID, port, scene |
| `dashboard` | Host Manager's own dashboard endpoint | Port |

Templates define executable path, arguments, environment variables, and working directory.

### 4. Web Dashboard

A should build a simple web dashboard (served by the Host Manager) with pages for:

- **Services** — list all processes, start/stop/restart buttons, status indicators,
- **Rooms** — room list from registry data (consumed from registry API, not from Host Manager internals),
- **Logs** — live log view via WebSocket, filter by service, search,
- **Health** — overall system health, process uptime, resource usage.

The dashboard consumes Host Manager and registry data. It never launches processes directly — always through Host Manager API.

### 5. Runtime Instance Isolation

A must ensure each room process is isolated:
- separate port allocation,
- separate working directory,
- separate log file,
- one crash does not affect other rooms.

---

## What A Should NOT Touch

| Area | Owner |
|------|-------|
| RuntimeEvent contract design | H (A reviews) |
| Marker detection & MR calibration | J |
| Telemetry emitter & Prometheus | H |
| PostgreSQL schema & event writer | N |
| Unity XR/interaction runtime code | J, N |
| Validation scenes | H |

---

## Practical Implementation Sequence

### STEP 1
Extend Host Manager with full process lifecycle API (start/stop/restart/status).

### STEP 2
Add service template system with registry and unity-room templates.

### STEP 3
Implement log capture per-service + file persistence.

### STEP 4
Add WebSocket log streaming endpoint.

### STEP 5
Build dashboard pages: Services, Rooms, Logs, Health.

### STEP 6
Add telemetry forwarding (receive from registry + Unity, forward to dashboard).

### STEP 7
Stress-test: start 3 rooms, stop 1, restart 1, verify isolation, verify logs are separated.

---

## Critical Design Rules

A useful test:

- If Registry is rewritten → Host Manager changes? **NO**
- If Unity is replaced → Host Manager changes? **NO**
- If SDK changes → Host Manager changes? **NO**
- If room schema changes → Host Manager changes? **NO**

If any answer becomes "yes", Host Manager has absorbed responsibilities it should not own.

---

## Final Ownership Boundary

```
Service Templates
        ↓
Host Manager (start/stop/restart/monitor)
        ↓
Process Isolation + Log Capture
        ↓
WebSocket Streaming
        ↓
Dashboard UI
```

That subsystem is:
- vertically sliced,
- self-contained,
- low-dependency,
- architecturally clean.
