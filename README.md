<div align="center">

<img src="panel/client/public/cxr-logo.png" alt="CXR" width="120" />

# CXR Multiplayer Infrastructure

**LAN-first multiplayer XR infrastructure for institutions — Unity + Mirror runtime, headless dedicated servers, and a real-time operations panel.**

[![Unity](https://img.shields.io/badge/Unity-2022.3.62f3-000000?logo=unity&logoColor=white)](https://unity.com/)
[![Mirror](https://img.shields.io/badge/Mirror-Networking-2196F3)](https://mirror-networking.com/)
[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A518-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Transport](https://img.shields.io/badge/Transport-KCP%2FUDP-orange)](https://github.com/MirrorNetworking/kcp2k)
[![Status](https://img.shields.io/badge/status-Phase%203%20active-success)]()

</div>

---

## Table of Contents

- [What is CXR?](#what-is-cxr)
- [System at a Glance](#system-at-a-glance)
- [Repository Layout](#repository-layout)
- [Part 1 — Unity Multiplayer Foundation](#part-1--unity-multiplayer-foundation)
- [Part 2 — CXR Backend Panel](#part-2--cxr-backend-panel)
- [Quick Start](#quick-start)
- [Headless Dedicated Servers](#headless-dedicated-servers)
- [Room Registry](#room-registry)
- [Deployment](#deployment)
- [Testing](#testing)
- [Documentation](#documentation)
- [Scope & Non-Goals](#scope--non-goals)
- [Roadmap](#roadmap)

---

## What is CXR?

CXR Multiplayer Infrastructure turns a scene-specific XR multiplayer prototype into a **reusable foundation** for local, institution-hosted multiplayer applications — classrooms, labs, training spaces, and other controlled LAN environments where teams need shared XR sessions **without depending on external cloud relay or matchmaking**.

The project deliberately **operationalizes proven networking technology** (Mirror over KCP/UDP) rather than building a custom engine. On top of that runtime sits a full **operations panel** that lets an operator launch headless rooms, watch live logs and metrics, manage Unity builds, and inspect the session event stream — all in real time, from a browser.

It assumes trusted users, institutional LANs, low-to-medium concurrency, and collaborative (not competitive) XR.

---

## System at a Glance

```text
            ┌──────────────────────────────────────────────────────────┐
            │                    CXR Backend Panel                      │
            │   React SPA  ◄── WebSocket (live state) ──►  Express API   │
            │   Overview · Rooms · Services · Logs · Health · Events     │
            └───────────────┬───────────────────────┬──────────────────┘
                            │ spawns / controls      │ persists events
                            ▼                         ▼
              ┌──────────────────────────┐   ┌─────────────────────────┐
              │  Headless Unity Rooms     │   │  Event Store            │
              │  (Mirror dedicated server)│   │  Supabase / PG / JSONL  │
              │  room A · room B · room C │   └─────────────────────────┘
              └─────────────┬─────────────┘
                            │ publishes /rooms
                            ▼
              ┌──────────────────────────┐        ┌──────────────────────┐
              │  Room Registry (HTTP)     │ ◄────  │  XR Clients (LAN)     │
              │  central room list        │  fetch │  Quest / PC / Editor  │
              └──────────────────────────┘        └──────────────────────┘
```

The two halves are independent but complementary: the **Unity foundation** is what runs inside every headless room and every XR client; the **Backend Panel** is the control plane that an operator uses to run and observe those rooms.

---

## Repository Layout

```text
CXR_Backend/
├── Assets/                          # Unity project
│   ├── Multiplayer/
│   │   ├── Core/                    # Runtime, discovery, facade, registry client
│   │   ├── Prefab/                  # XRNetworkManager, DebugGUI, participant, entity
│   │   ├── Scenes/                  # Lobby / session / testing scenes
│   │   ├── Server/                  # Headless server command-line config
│   │   ├── Testing/                 # Runtime validation helpers
│   │   └── Tests/Editor/            # NUnit editor tests
│   └── SDK/                         # Standalone LAN discovery SDK
├── panel/                           # ★ CXR Backend Panel (ops portal)
│   ├── client/                      # React + Vite SPA
│   │   └── src/
│   │       ├── pages/               # Overview, Rooms, Services, Logs, Health…
│   │       ├── components/ui/       # Design system + animated components
│   │       └── contexts/            # Auth, Theme, Realtime (WebSocket)
│   ├── server/                      # Express API + integrated host manager
│   │   ├── hm/                      # processManager, roomManager, webSocketServer
│   │   ├── routes/                  # auth, events, builds-upload
│   │   ├── auth/                    # JWT + bcrypt user store + RBAC
│   │   ├── registry/                # Embedded room registry service
│   │   └── db/                      # Event writer (Supabase / PG / JSONL)
│   └── docker-compose.yml           # Optional PostgreSQL / pgAdmin stack
├── tools/room-registry/             # Standalone HTTP room registry
├── docs/                            # Architecture & developer blueprints
├── ProjectSettings/  Packages/      # Unity configuration
└── README.md
```

---

## Part 1 — Unity Multiplayer Foundation

The reusable Mirror-based runtime that powers hosts, clients, and dedicated servers.

### Core Runtime Pieces

| Component | Responsibility |
|-----------|----------------|
| **`XRNetworkManager`** | Central Mirror manager — transport setup, server lifecycle, session start/stop, discovery integration, spawn-prefab registration, cleanup. Prefab: `Assets/Multiplayer/Prefab/XRNetworkManager.prefab` |
| **`XRMultiplayerRuntimeFacade`** | The **public API boundary** for UI and app code. Exposes connection state, room list, discovery lifecycle, session state, participant counts, local IDs, and host/server/client/join/stop/refresh commands. App teams build against this, not the low-level components. |
| **`XRMultiplayerDebugGUI`** | Immediate-mode debug UI and reference implementation for building production UI on the facade. Prefab: `Assets/Multiplayer/Prefab/XRMultiplayerDebugGUI.prefab` |
| **`RuntimeSessionManager`** | Server-side participant registration, session state, metadata, and disconnect cleanup. |
| **`RuntimeEntity`** | Base lifecycle for networked objects — ownership, init, activation, spawn, despawn, cleanup. |
| **`RemoteRoomRegistry`** | Publishes room metadata to a central HTTP registry so one machine can host many rooms. |

### Capabilities

- Mirror host / client / dedicated-server lifecycle over **KCP transport**
- LAN room discovery + join flow
- Runtime session state and participant tracking
- Networked entity ownership, spawn, despawn, cleanup helpers
- Dedicated/headless server launcher with CLI + environment configuration
- HTTP room registry for multi-room validation across machines
- XR presence pipeline (head/controller/body sync) — see Phase 2 docs

---

## Part 2 — CXR Backend Panel

A single-binary **operations portal** that runs the registry, launches and supervises headless Unity rooms, streams live logs and metrics, manages build artifacts, and persists the session event stream — all behind a session-authenticated React UI.

> One server process. No separate host-manager or registry to run — the registry is launched from inside the panel.

### Feature Matrix

| Page | What it does |
|------|--------------|
| **Overview** | Live dashboard — room/service counts, status donut, event-type charts, capacity bars, connection info. |
| **Host Manager** | Start / stop / restart the room registry; view panel + registry health; list discovered Unity builds and all managed services. |
| **Rooms** | Create rooms from any discovered build, pick capacity, watch live status, restart/stop, tail per-room logs. |
| **Services** | Process supervisor — every managed child process with status, PID, port, restart count, uptime, and live log tail. |
| **Live Logs** | Single multiplexed WebSocket stream of stdout/stderr from every process, with service/stream filters and search. |
| **Health** | Panel server, registry, and network diagnostics; telemetry snapshot; host-log tail. |
| **Events** | Inspect, filter, and replay the persisted XR session event stream; emit test events. |
| **Build Upload** | Drag-and-drop a Unity Linux headless build archive (`.zip/.rar/.tar.gz/.tar`); auto-extracts and registers it for room creation. |
| **Users** | Admin-only RBAC — create users, set roles (`admin` / `operator` / `viewer`), reset passwords. |

### Architecture Highlights

- **Real-time everywhere** — a single shared WebSocket pushes a full state snapshot every 2s and on every mutation, so room/service/registry changes land in **all open tabs in under 100 ms**. HTTP polling exists only as a 30s fallback.
- **Integrated host manager** — `processManager` supervises child processes with crash recovery + exponential backoff; `roomManager` maps rooms to processes, allocates ports, and syncs the live build registry.
- **Session auth + RBAC** — httpOnly `cxr_session` JWT cookie, bcrypt-hashed users, three roles. A static `X-CXR-Admin-Token` header path is supported for Unity/automation clients.
- **Pluggable persistence** — the event writer auto-selects a backend: **Supabase → PostgreSQL → JSONL** file fallback, so it runs with zero external dependencies out of the box.
- **Safe SPA routing** — browser navigations (`Sec-Fetch-Dest: document`) get the SPA shell; API fetches to the same paths (`/rooms`, `/health`, `/builds`) fall through to JSON.

### Tech Stack

**Frontend** — React 18 · Vite 5 · Tailwind CSS 3 · Framer Motion · Recharts · Lucide
**Backend** — Node.js · Express 4 · `ws` · Multer · jsonwebtoken · bcryptjs
**Persistence** — Supabase / PostgreSQL (`pg`) / JSONL fallback

---

## Quick Start

### A) Unity Editor (host + client)

1. Open the repo in **Unity 2022.3.62f3**.
2. Open a scene from `Assets/Multiplayer/Scenes`.
3. Confirm it contains `XRNetworkManager.prefab` and `XRMultiplayerDebugGUI.prefab`.
4. Press **Play** → use the debug GUI to Host / Server / Client / refresh / join.

### B) Backend Panel (operator portal)

```bash
# 1. Build the React client
cd panel/client
npm install
npm run build

# 2. Start the panel server (serves the API + built client)
cd ../server
npm install
npm start
```

Open **http://localhost:4000** → log in with the default admin account:

```text
username: admin
password: admin      # change immediately via the Users page
```

> Windows shortcut: run `panel/start.bat` after building the client.

**Optional environment variables** (panel server):

```bash
PANEL_PORT=4000                  # panel HTTP port
CXR_PUBLIC_ADDRESS=192.168.1.20  # LAN address advertised to clients (auto-detected by default)
CXR_ADMIN_TOKEN=your-secret      # enables static-token API access for automation
CXR_ROOM_PORT_START=7777         # room port allocation range
CXR_ROOM_PORT_END=7900
SUPABASE_URL=...                 # event backend (optional)
SUPABASE_SERVICE_ROLE_KEY=...
DATABASE_URL=postgresql://...    # PostgreSQL fallback (optional)
```

### C) LAN Validation Checklist

- Both machines on the same Wi-Fi/LAN.
- Firewall allows the Mirror transport port (default `7777/udp`).
- Firewall allows registry port `8080/tcp` if using the remote registry.
- Clients use the **server machine's LAN IP**, never `localhost`.
- Rebuild into a fresh output folder after changing Player Settings.

---

## Headless Dedicated Servers

Build a standalone player, then run it in batch/headless mode.

```bash
# Linux
./CXR_Backend.x86_64 -batchmode -nographics -logFile - \
  --cxr-headless-server \
  --room-name="XR Dedicated Validation" \
  --max-participants=8 \
  --port=7777 \
  --public-address=192.168.1.20 \
  --registry-url=http://192.168.1.20:8080 \
  --metadata=scenario=phase1 \
  --metadata=environment=lan
```

```powershell
# Windows
YourBuild.exe -batchmode -nographics -logFile - -cxrHeadlessServer
```

Equivalent environment variables:

```bash
CXR_HEADLESS_SERVER=1
CXR_ROOM_NAME="XR Dedicated Validation"
CXR_MAX_PARTICIPANTS=8
CXR_PORT=7777
CXR_PUBLIC_ADDRESS=192.168.1.20
CXR_REGISTRY_URL=http://192.168.1.20:8080
CXR_METADATA="scenario=phase1;environment=lan"
```

> In practice you won't run these by hand — the **Backend Panel → Rooms** page launches and supervises headless rooms for you, with live logs and one-click stop/restart.

---

## Room Registry

A lightweight HTTP service that lets one machine host **multiple** room processes and gives clients a single list to browse. The panel runs an embedded copy; a standalone version lives in `tools/room-registry/`.

```bash
# Standalone
node tools/room-registry/server.js

# Configurable
export CXR_REGISTRY_HOST=0.0.0.0
export CXR_REGISTRY_PORT=8080
export CXR_REGISTRY_STALE_MS=15000
node tools/room-registry/server.js
```

**Endpoints:** `GET /health` · `GET /rooms` · `POST /rooms` · `DELETE /rooms/:roomId`

Publishing is **event-driven** — rooms post on server-activity, session-state, and join/leave changes, with a slower heartbeat to keep stale-room cleanup reliable. A client points the debug GUI (or panel) at `http://<server-ip>:8080`, applies the URL, and refreshes.

> **HTTP build note:** Unity standalone builds block `http://` unless *Player Settings → Allow downloads over HTTP* is enabled. Rebuild into a fresh folder after changing it, and front the registry with HTTPS + auth before production.

---

## Deployment

The panel is designed to run on a single Linux VPS / lab server.

```bash
# Pull latest, rebuild the client, restart under a process manager
git pull
cd panel/client && npm install && npm run build
cd ../server  && npm install
pm2 restart cxr-panel        # or: node server.js
```

Optional **PostgreSQL + pgAdmin** stack for event persistence:

```bash
cd panel
docker compose up -d              # PostgreSQL on :5432
docker compose --profile tools up -d   # + pgAdmin on :5050
# then set DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cxr
```

Without any database configured, events fall back to an append-only JSONL file — the panel runs with **zero external dependencies**.

---

## Testing

```bash
# Unity editor tests
#   Assets/Multiplayer/Tests/Editor
#   Assets/SDK/Tests/Editor

# Registry syntax check
node --check tools/room-registry/server.js

# Panel client production build (catches all import/compile errors)
cd panel/client && npm run build
```

**Manual validation matrix:** host/client in Editor · two standalone builds on one machine · host + client on separate machines · remote registry refresh · headless launch with metadata · participant join/leave cleanup · panel room create/stop/restart reflected live across browser tabs.

---

## Documentation

Deep developer documentation lives in [`docs/`](docs/README.md):

| Area | Document |
|------|----------|
| System architecture | [Multiplayer Foundation Architecture](docs/Multiplayer_Foundation_Architecture.md) |
| Manager prefab | [XRNetworkManager Prefab Blueprint](docs/NetworkManager_Prefab_Blueprint.md) |
| Public API / UI | [Runtime Facade & Debug GUI Blueprint](docs/RuntimeFacade_DebugGUI_Blueprint.md) |
| Discovery & sessions | [Discovery and Session Blueprint](docs/Discovery_Session_Blueprint.md) |
| Participants | [Runtime Participant Blueprint](docs/RuntimeParticipant_Blueprint.md) |
| Networked entities | [Runtime Entity Blueprint](docs/RuntimeEntity_Blueprint.md) |
| Dedicated servers | [Headless Server Testing](docs/Headless_Server_Testing.md) |
| Multi-room hosting | [Remote Room Registry](docs/Remote_Room_Registry.md) |
| XR presence (Phase 2) | [XR Presence Pipeline Blueprint](docs/XR_Presence_Pipeline_Blueprint.md) |
| Event contract | [Runtime Event Contract](docs/Runtime_Event_Contract.md) |
| Persistence | [Persistence Blueprint](docs/Persistence_Blueprint.md) |

Lower-level standalone discovery SDK docs: `Assets/SDK/Documentation`.

---

## Scope & Non-Goals

**This project is:** LAN-first, trusted-user, low-to-medium concurrency, collaborative XR infrastructure with an operations control plane.

**This project is *not*:**

- A custom networking engine
- Internet-scale matchmaking or NAT traversal
- Cloud relay infrastructure
- MMO-scale orchestration
- Competitive rollback / anti-cheat / deterministic simulation
- Collaborative SLAM, cloud anchors, or room reconstruction

Internet-scale deployment, relay services, and cloud matchmaking are explicitly **future concerns, not current assumptions**.

---

## Roadmap

| Phase | Focus | Status |
|-------|-------|--------|
| **Phase 1** | Mirror multiplayer foundation — host/client/server, discovery, sessions, entities, headless servers, registry | ✅ Complete |
| **Phase 2** | XR presence pipeline — head/controller/body sync, MR marker calibration, interactable sync | ✅ Complete |
| **Phase 3** | Operations panel — real-time host manager, build upload, log/metric streaming, RBAC, event persistence | 🟢 Active |
| **Future** | Production observability, HTTPS + authenticated registry, deployment automation | ⚪ Planned |

---

<div align="center">

**CXR Multiplayer Infrastructure** — built for institutional XR, LAN-first by design.

</div>
