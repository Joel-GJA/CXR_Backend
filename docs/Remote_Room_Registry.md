# Remote Room Registry

## Purpose

The remote room registry enables one physical server to host multiple Unity headless room processes.

Each Unity process is still one Mirror room/session, but every process registers itself with one central HTTP registry. Client applications fetch the registry room list, display rooms, and connect directly to the selected room IP and port.

## Architecture

```text
Physical server
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

Run on the server:

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

On startup, the server logs all detected LAN IP addresses and access URLs:

```
CXR room registry listening on http://0.0.0.0:8080, staleAfterMs=15000
  Access URLs:
    http://localhost:8080  (this machine only)
    http://192.168.1.100:8080  (eth0)
```

Endpoints:

- `GET /health`: service health and room count.
- `GET /rooms`: active rooms (returns JSON array of room objects).
- `POST /rooms`: upsert a room heartbeat. Body must include `roomId`, `ipAddress`, and `port`. Returns 400 if `ipAddress` or `port` are missing/invalid.
- `DELETE /rooms/:roomId`: remove a room.

The service removes stale rooms that stop heartbeating. Cleanup runs on a periodic timer (`setInterval` at `max(5000ms, staleAfterMs/2)` with `.unref()`) instead of on every request.

## Unity Publisher

Script:

`Assets/Multiplayer/Core/Rooms/RemoteRoomRegistryPublisher.cs`

This component is attached to `XRNetworkManager.prefab`. A headless server process publishes its room to the registry while Mirror server mode is active.

### Serialized Fields

| Field | Default | Description |
|---|---|---|
| `registryUrl` | `""` | Target registry URL (e.g. `http://192.168.1.100:8080`) |
| `publicAddress` | `""` | Explicit public address; if empty, falls back to LAN auto-detect |
| `publicPort` | `7777` | Explicit public port; if zero, uses the broadcaster port |
| `publishOnlyWhenServerActive` | `true` | Skip publishing when `NetworkServer.active` is false |
| `publishCheckIntervalSeconds` | `1` | How often the publish loop evaluates whether to act |
| `safetyHeartbeatSeconds` | `30` | Re-publish interval when no other events trigger a publish |
| `publishRetryIntervalSeconds` | `5` | Delay between HTTP failure retries |
| `maxPublishRetries` | `3` | Max consecutive "server not active" retries before abandoning (0 = infinite) |
| `discoveryBroadcaster` | auto-resolved | Source for room metadata (room ID, name, player counts, etc.) |
| `sessionManager` | auto-resolved | Source for session state change events |

### Publishing Triggers

1. **Immediate initial publish** — `OnEnable()` fires `MarkPublishRequested()`; the loop picks it up on the next tick.
2. **Server start** — `XRMultiplayerRuntimeFacade.StartHost()` / `StartServer()` calls `PublishRoomToRegistry()` which syncs the registry URL from the browser (if unset) and calls `PublishNow()`.
3. **Session state changes** — subscribed to `RuntimeSessionManager.StateChanged` and `ParticipantRegistered`/`ParticipantUnregistered`.
4. **Safety heartbeat** — every `safetyHeartbeatSeconds` while `NetworkServer.active`, to prevent stale-room cleanup.
5. **Manual** — `PublishNow()` can be called from code or from the debug GUI "Advertise Room" button.

### Concurrency Guard

`isPublishing` prevents overlapping `PublishOnce()` coroutines. If `PublishNow()` is called while a publish is in flight, `publishQueued` is set to `true` and a re-publish fires automatically after the current one completes.

### Retry Behavior

- **"Server not active" deferral**: increments `publishRetryCount`. After `maxPublishRetries` (default 3) consecutive deferrals, publishing is abandoned with a warning. Clicking "Advertise Room" or any session event resets the counter.
- **HTTP failure**: retries after `publishRetryIntervalSeconds` (default 5s) via `ScheduleRetry()`. The retry count also applies here, but `MarkPublishRequested()` (called from session events, button clicks, and safety heartbeat) resets it.

### LAN IP Auto‑Detection

When neither `publicAddress` nor the fallback (from `DiscoveryBroadcaster.TryBuildResponse`) provides an IP, `ResolvePublicAddress()` calls `RemoteRoomRegistryBrowser.TryResolveLanAddress()` to detect the local LAN IP. This prevents sending an empty `ipAddress` to the registry server.

### Published Data

```json
{
  "roomId": "abc-123",
  "roomName": "Training Room A",
  "playerCount": 2,
  "maxPlayers": 16,
  "status": "Open",
  "ipAddress": "192.168.1.100",
  "port": 7777,
  "metadata": { "room": "A" }
}
```

### Diagnostic Logs

The publisher emits `[REMOTE ROOM REGISTRY]` prefixed logs for:
- "Publish skipped: already publishing."
- "Publish skipped: no registry URL configured."
- "Publish deferred: server not active yet."
- "Publish abandoned after N retries: server not active."
- "Publish skipped: DiscoveryBroadcaster not found."
- "Publish skipped: DiscoveryBroadcaster.TryBuildResponse returned false."
- "Publish skipped: registry URL is invalid."
- "Publish failed: {error}"

## Unity Browser

Script:

`Assets/Multiplayer/Core/Rooms/RemoteRoomRegistryBrowser.cs`

This component is attached to `XRMultiplayerDebugGUI.prefab`. Client apps can configure a registry URL, refresh remote rooms, and join the selected room through `JoinRoomHandler`.

### Serialized Fields

| Field | Default | Description |
|---|---|---|
| `registryUrl` | `""` | Target registry URL (e.g. `http://192.168.1.100:8080`) |
| `configureFromEnvironmentOrCommandLine` | `true` | Read `CXR_REGISTRY_URL` env var or `--registry-url` arg |
| `joinRoomHandler` | auto-resolved | Component that handles the join workflow |
| `autoRefreshIntervalSeconds` | `0` | Timer-based polling interval (0 = disabled). Default is 0; use discovery-driven refresh instead. |
| `discoveryManager` | auto-resolved | SDK `DiscoveryManager` whose `RoomsChanged` event triggers remote refreshes |

### Refresh Triggers

1. **LAN discovery events** — subscribes to `DiscoveryManager.RoomsChanged` in `OnEnable()`. When LAN discovery finds or updates rooms, the browser fires a GET to the remote registry. This is the primary refresh mechanism (no polling).
2. **Fallback timer** — if `autoRefreshIntervalSeconds` is set to a positive value, `Update()` polls at that interval (legacy mode).
3. **Manual** — `RefreshRooms()` can be called from code or from the debug GUI "Refresh Registry" button.

### Stale-Response Guard

`refreshSequence` is incremented before each HTTP request. If a response arrives after a newer refresh was started, it is discarded to prevent stale data from overwriting fresh results.

### URL Normalization (`NormalizeRegistryUrl`)

The static method `NormalizeRegistryUrl` processes user-supplied URLs:

1. Strips whitespace.
2. Prepends `http://` if no scheme is present.
3. Strips trailing `/`.
4. Replaces `127.0.0.1`, `localhost`, or `0.0.0.0` with the detected LAN IP (via `TryResolveLanAddress`).

This ensures that `--registry-url=http://127.0.0.1:8080` becomes `http://192.168.1.100:8080` automatically.

### LAN IP Resolution (`TryResolveLanAddress`)

A public static helper that enumerates `Dns.GetHostEntry` addresses and returns the first non-loopback IPv4 address. Returns `false` with an empty string if no suitable address is found. Used by both the browser and the publisher (`ResolvePublicAddress`).

### Room Selection

The runtime facade (`XRMultiplayerRuntimeFacade`) prefers remote registry rooms when the browser has results, then falls back to LAN discovery rooms.

## Debug GUI Integration

The debug GUI (`XRMultiplayerDebugGUI`) provides a remote registry section with:

- **Registry URL text field** and **Apply URL** button.
- **Refresh Registry** button — calls `RefreshRooms()`.
- **Advertise Room** button — syncs the URL to the publisher and calls `PublishNow()`.
- **Status display** — last error, response code, last refresh time, visible room count.
- **Room list** — displays room name, IP, port, player count, and status.

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
  --room-name "Training Room A" \
  --port 7777 \
  --public-address 203.0.113.10 \
  --registry-url http://127.0.0.1:8080 \
  --metadata room=A
```

Start room B:

```bash
./CXR_Backend.x86_64 -batchmode -nographics \
  -logFile - \
  --cxr-headless-server \
  --room-name "Training Room B" \
  --port 7778 \
  --public-address 203.0.113.10 \
  --registry-url http://127.0.0.1:8080 \
  --metadata room=B
```

Start room C:

```bash
./CXR_Backend.x86_64 -batchmode -nographics \
  -logFile - \
  --cxr-headless-server \
  --room-name "Training Room C" \
  --port 7779 \
  --public-address 203.0.113.10 \
  --registry-url http://127.0.0.1:8080 \
  --metadata room=C
```

> **Note**: Use space-separated arguments (`--room-name "Room A"`) rather than inline `=` syntax for values with spaces. The `=` syntax (`--room-name="Room A"`) may cause PowerShell to split the argument on the space.

## Client Configuration

Set the client registry URL to the server's LAN IP with:

```bash
./CXR_Backend.x86_64 --registry-url http://203.0.113.10:8080
```

or with the environment variable:

```bash
export CXR_REGISTRY_URL=http://203.0.113.10:8080
./CXR_Backend.x86_64
```

The URL `http://localhost:8080` or `http://127.0.0.1:8080` is also valid on the headless server — `NormalizeRegistryUrl` resolves it to the LAN IP automatically.

Rooms refresh automatically when LAN discovery detects changes (via `DiscoveryManager.RoomsChanged`). Manual refresh is available through the debug GUI "Refresh Registry" button or `XRMultiplayerRuntimeFacade.RefreshRooms()`.

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
