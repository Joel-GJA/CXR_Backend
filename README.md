# CXR Multiplayer Infrastructure

Reusable LAN-first multiplayer infrastructure for institutional XR applications built in Unity with Mirror Networking.

## Overview

CXR Multiplayer Infrastructure is a Unity project that turns a scene-specific XR multiplayer prototype into a reusable foundation for local, institution-hosted multiplayer applications. It is designed for classrooms, labs, training spaces, and other controlled LAN environments where teams need multiplayer XR sessions without depending on external cloud relay or matchmaking services.

The project focuses on operationalizing existing multiplayer technology rather than building a custom networking engine. It provides a reusable Mirror-based runtime, LAN room discovery, session metadata, participant lifecycle tracking, networked runtime entity patterns, headless server launch support, and a lightweight remote room registry for multi-room validation.

## Project Goals

- Host multiplayer XR sessions on local networks.
- Standardize room discovery, join flow, session state, and disconnect cleanup.
- Provide reusable prefabs and runtime APIs for Unity application teams.
- Support dedicated/headless multiplayer server builds.
- Enable multi-room testing on one server machine through a central registry.
- Keep the architecture simple, local, and maintainable for institutional deployment.

## Current Scope

This repository currently implements the Phase 1 multiplayer networking foundation:

- Mirror host, client, and server lifecycle.
- KCP transport configuration through Mirror.
- LAN room discovery and room joining.
- Runtime session state and participant tracking.
- Runtime entity ownership, spawn, despawn, and cleanup helpers.
- Debug GUI built on a production-facing runtime facade.
- Dedicated/headless server launcher with command-line and environment configuration.
- HTTP room registry for multi-room validation across machines.

Future phases from the project proposal include XR synchronization templates, marker-based MR alignment, telemetry, observability, persistence, and deployment automation.

## What This Is Not

This project intentionally does not try to provide:

- A custom networking engine.
- Internet-scale matchmaking or NAT traversal.
- Cloud relay infrastructure.
- MMO-scale orchestration.
- Competitive multiplayer rollback, anti-cheat, or deterministic simulation.
- Collaborative SLAM, cloud anchors, or room reconstruction.

The architecture assumes trusted users, institutional LANs, low-to-medium concurrency, and collaborative XR applications.

## Tech Stack

- Unity `2022.3.62f3`
- Mirror Networking
- KCP transport
- Unity headless/server builds
- Node.js registry service for remote room lists
- NUnit-based Unity editor tests

## Repository Layout

```text
Assets/
  Multiplayer/
    Core/             Multiplayer runtime, discovery lifecycle, facade, UI, room registry client
    Prefab/           Reusable manager, participant, entity, debug GUI, and sample prefabs
    Scenes/           Lobby/session/testing scenes
    Server/           Headless server command-line configuration
    Testing/          Runtime validation helpers and testing scenes
    Tests/Editor/     Editor tests for runtime and registry behavior
  SDK/
    Runtime/          Lower-level room discovery SDK
    Documentation/    SDK-specific integration and testing docs
docs/                 Architecture and developer blueprints
tools/
  room-registry/      Lightweight HTTP registry server for multi-room hosting
ProjectSettings/     Unity project settings
Packages/            Unity package manifest and lockfile
```

## Core Runtime Pieces

### `XRNetworkManager`

The main Mirror network manager for this foundation. It centralizes transport setup, server lifecycle, session startup/shutdown, discovery integration, spawn prefab registration, and runtime cleanup.

Prefab:

```text
Assets/Multiplayer/Prefab/XRNetworkManager.prefab
```

### `XRMultiplayerRuntimeFacade`

The public API boundary for UI and application code. App teams should prefer this facade over directly calling lower-level networking components.

It exposes:

- connection state
- network address
- visible room list
- discovery lifecycle
- remote registry diagnostics
- session state
- participant counts
- local player/network IDs
- host, server, client, join, stop, and refresh commands

### `XRMultiplayerDebugGUI`

An immediate-mode debug UI and reference implementation for building production UI on top of the runtime facade.

Prefab:

```text
Assets/Multiplayer/Prefab/XRMultiplayerDebugGUI.prefab
```

### `RuntimeSessionManager`

Tracks server-side participant registration, session state, participant metadata, and disconnect cleanup.

### `RuntimeEntity`

Base lifecycle model for networked objects that need ownership, initialization, activation, cleanup, spawn, and despawn behavior.

### `RemoteRoomRegistry`

The remote registry path allows one server machine to host multiple headless Unity room processes. Each room publishes metadata to a central HTTP registry, and clients fetch `/rooms` to display available rooms.

Registry server:

```text
tools/room-registry/server.js
```

## Quick Start: Unity Editor

1. Open the repository in Unity `2022.3.62f3`.
2. Open a multiplayer scene from:

```text
Assets/Multiplayer/Scenes
```

3. Ensure the scene has:

```text
XRNetworkManager.prefab
XRMultiplayerDebugGUI.prefab
```

4. Press Play.
5. Use the debug GUI to start Host, Server, Client, refresh rooms, and join rooms.

## Quick Start: LAN Validation

For same-LAN testing, run one build or editor instance as the host/server and another as the client.

Recommended checks:

- Both machines are on the same Wi-Fi/LAN.
- Firewall allows the Mirror transport port, usually `7777/udp`.
- Firewall allows registry port `8080/tcp` if using the remote registry.
- The client uses the server machine's LAN IP, not `localhost`.
- Standalone builds are built into a fresh output folder after changing Player Settings.

## Headless Server

Build a standalone player, then run it in batch/headless mode.

Windows:

```powershell
YourBuild.exe -batchmode -nographics -logFile - -cxrHeadlessServer
```

Linux:

```bash
./CXR_Backend.x86_64 -batchmode -nographics -logFile - --cxr-headless-server
```

Example with room configuration:

```bash
./CXR_Backend.x86_64 -batchmode -nographics \
  -logFile - \
  --cxr-headless-server \
  --room-name="XR Dedicated Validation" \
  --max-participants=8 \
  --port=7777 \
  --metadata=scenario=phase1 \
  --metadata=environment=lan
```

Supported environment variables include:

```bash
CXR_HEADLESS_SERVER=1
CXR_ROOM_NAME="XR Dedicated Validation"
CXR_MAX_PARTICIPANTS=8
CXR_PORT=7777
CXR_PUBLIC_ADDRESS=192.168.1.20
CXR_REGISTRY_URL=http://192.168.1.20:8080
CXR_METADATA="scenario=phase1;environment=lan"
```

## Remote Room Registry

The remote room registry is useful when one machine hosts multiple room processes or when LAN broadcast discovery is not enough for the current test environment.

Start the registry:

```bash
node tools/room-registry/server.js
```

Configure it:

```bash
export CXR_REGISTRY_HOST=0.0.0.0
export CXR_REGISTRY_PORT=8080
export CXR_REGISTRY_STALE_MS=15000
node tools/room-registry/server.js
```

Endpoints:

- `GET /health`
- `GET /rooms`
- `POST /rooms`
- `DELETE /rooms/:roomId`

Start a room that publishes to the registry:

```bash
./CXR_Backend.x86_64 -batchmode -nographics \
  -logFile - \
  --cxr-headless-server \
  --room-name="Training Room A" \
  --port=7777 \
  --public-address=192.168.1.20 \
  --registry-url=http://192.168.1.20:8080 \
  --metadata=room=A
```

On the client, set the debug GUI registry URL to:

```text
http://192.168.1.20:8080
```

Then click `Apply URL` and `Refresh Registry`.

The debug GUI shows the last HTTP status and response byte count. The registry server logs each request with remote IP, method, path, status, and response size.

## HTTP Registry Build Note

The Phase 1 registry uses HTTP for local validation. Unity standalone builds block `http://` requests unless Player Settings allow them.

Current validation setting:

```text
Player Settings > Other Settings > Configuration > Allow downloads over HTTP: Always allowed
```

After changing this setting, build into a fresh output folder. Unity can preserve stale player settings in old build output.

Before production deployment, put the registry behind HTTPS, add publisher authentication, and return this setting to a stricter option.

## Event-Driven Registry Publishing

Room registry publishing is not a constant tight loop. The publisher posts when:

- server activity changes
- session state changes
- participants join
- participants leave

A slower safety heartbeat keeps stale-room cleanup reliable if no room data changes for a while.

## Testing

Editor tests live in:

```text
Assets/Multiplayer/Tests/Editor
Assets/SDK/Tests/Editor
```

The registry server can be syntax-checked with:

```bash
node --check tools/room-registry/server.js
```

Manual validation should cover:

- host/client in the Unity Editor
- two standalone builds on the same machine
- host and client on separate machines on the same Wi-Fi
- remote registry refresh from a second machine
- headless server launch with room metadata
- participant join/leave cleanup

## Documentation

The detailed developer documentation is in `docs/`:

- [Multiplayer Foundation Architecture](docs/Multiplayer_Foundation_Architecture.md)
- [XRNetworkManager Prefab Blueprint](docs/NetworkManager_Prefab_Blueprint.md)
- [Runtime Facade and Debug GUI Blueprint](docs/RuntimeFacade_DebugGUI_Blueprint.md)
- [Discovery and Session Blueprint](docs/Discovery_Session_Blueprint.md)
- [Runtime Participant Blueprint](docs/RuntimeParticipant_Blueprint.md)
- [Runtime Entity Blueprint](docs/RuntimeEntity_Blueprint.md)
- [Headless Server Testing](docs/Headless_Server_Testing.md)
- [Remote Room Registry](docs/Remote_Room_Registry.md)
- [Example Scenes Blueprint](docs/Example_Scenes_Blueprint.md)

Lower-level SDK docs are in:

```text
Assets/SDK/Documentation
```

## Development Status

The repository is currently focused on the multiplayer networking foundation. It provides the operational base for later XR-specific work such as rig synchronization, synchronized interactables, MR coordinate alignment, telemetry, logging, and persistence.

The most important current boundary: this is LAN-first infrastructure. Internet-scale deployment, NAT traversal, relay services, cloud matchmaking, and production observability are future concerns, not current assumptions.

