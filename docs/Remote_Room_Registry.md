# Remote Room Registry

## Purpose

The remote room registry enables one physical Ubuntu server to host multiple Unity headless room processes.

Each Unity process is still one Mirror room/session, but every process registers itself with one central HTTP registry. Client applications fetch the registry room list, display rooms, and connect directly to the selected room IP and port.

## Architecture

```text
Ubuntu physical server
  HTTP room registry on 8080
  Unity room A on 7777
  Unity room B on 7778
  Unity room C on 7779

Client app
  GET http://server:8080/rooms
  select room
  connect to room.ipAddress:room.port
```

## Registry Service

Script:

`tools/room-registry/server.js`

Run on Ubuntu:

```bash
node tools/room-registry/server.js
```

Configure with environment variables:

```bash
export CXR_REGISTRY_HOST=0.0.0.0
export CXR_REGISTRY_PORT=8080
export CXR_REGISTRY_STALE_MS=15000

node tools/room-registry/server.js
```

Endpoints:

- `GET /health`: service health and room count.
- `GET /rooms`: active rooms.
- `POST /rooms`: upsert a room heartbeat.
- `DELETE /rooms/:roomId`: remove a room.

The service removes stale rooms that stop heartbeating.

## Unity Publisher

Script:

`Assets/Multiplayer/Core/Rooms/RemoteRoomRegistryPublisher.cs`

This component is attached to `XRNetworkManager.prefab`. A headless server process publishes its room to the registry while Mirror server mode is active.

Publishing is event-driven for normal updates: the server posts when the server becomes active, session state changes, or participants join/leave. A slower safety heartbeat keeps stale-room cleanup reliable if no room data changes for a while.

Published data:

- room ID
- room name
- public IP/address
- public port
- participant count
- max participants
- status
- metadata

## Unity Browser

Script:

`Assets/Multiplayer/Core/Rooms/RemoteRoomRegistryBrowser.cs`

This component is attached to `XRMultiplayerDebugGUI.prefab`. Client apps can configure a registry URL, refresh remote rooms, and join the selected room through `JoinRoomHandler`.

The runtime facade prefers remote registry rooms when the registry browser has results, then falls back to LAN discovery rooms.

## Starting Multiple Rooms

Start the registry:

```bash
node tools/room-registry/server.js
```

Start room A:

```bash
./CXR_Backend.x86_64 -batchmode -nographics \
  -logFile - \
  --cxr-headless-server \
  --room-name="Training Room A" \
  --port=7777 \
  --public-address=203.0.113.10 \
  --registry-url=http://127.0.0.1:8080 \
  --metadata=room=A
```

Start room B:

```bash
./CXR_Backend.x86_64 -batchmode -nographics \
  -logFile - \
  --cxr-headless-server \
  --room-name="Training Room B" \
  --port=7778 \
  --public-address=203.0.113.10 \
  --registry-url=http://127.0.0.1:8080 \
  --metadata=room=B
```

Start room C:

```bash
./CXR_Backend.x86_64 -batchmode -nographics \
  -logFile - \
  --cxr-headless-server \
  --room-name="Training Room C" \
  --port=7779 \
  --public-address=203.0.113.10 \
  --registry-url=http://127.0.0.1:8080 \
  --metadata=room=C
```

## Client Configuration

Set the client `RemoteRoomRegistryBrowser.registryUrl` to:

```text
http://203.0.113.10:8080
```

For builds, the registry URL can also be passed with:

```bash
./CXR_Backend.x86_64 --registry-url=http://203.0.113.10:8080
```

or:

```bash
export CXR_REGISTRY_URL=http://203.0.113.10:8080
./CXR_Backend.x86_64
```

Then refresh rooms through the debug GUI or through `XRMultiplayerRuntimeFacade.RefreshRooms()`.

## Unity HTTP Setting

The Phase 1 registry uses plain HTTP by default. Unity blocks `http://` requests unless Player Settings allow non-secure HTTP connections.

For current development and validation builds, this project sets:

```text
Player Settings > Other Settings > Configuration > Allow downloads over HTTP: Always allowed
```

If the registry works in the Unity Editor but fails in a standalone player with `Insecure connection not allowed`, rebuild the player after confirming this setting for the active build target. The player bakes this setting at build time.

Before production deployment, put the registry behind HTTPS, such as nginx with TLS, and change this setting back to a stricter option.

When a room is selected, the client connects directly to:

```text
room.ipAddress:room.port
```

## Firewall

Open the registry port:

```bash
sudo ufw allow 8080/tcp
```

Open one transport port per room:

```bash
sudo ufw allow 7777/udp
sudo ufw allow 7778/udp
sudo ufw allow 7779/udp
```

KCP primarily uses UDP.

## Production Notes

This registry is intentionally lightweight for Phase 1 validation. Before using it in production, add:

- authentication for room publishers
- TLS termination through nginx or a load balancer
- request rate limits
- structured logs
- persistence or a managed backing store if needed
- health checks per room process
