# Headless Server Testing

## Purpose

This guide documents the Phase 1 dedicated/headless server path.

The headless path proves that the multiplayer foundation can run without player UI, advertise a LAN room, accept clients, track participants, and clean up runtime state when clients disconnect.

## Runtime Component

Script:

`Assets/Multiplayer/Server/HeadlessServerLauncher.cs`

Prefab:

`Assets/Multiplayer/Prefab/XRNetworkManager.prefab`

`HeadlessServerLauncher` is attached to the network manager prefab and can:

- auto-start server mode in batch mode
- start server mode when `-cxrHeadlessServer` is present
- configure advertised room name
- configure max participants
- configure transport/discovery port
- publish extra discovery metadata
- mark the room as a dedicated server through metadata

## Ubuntu Command Line

Build a Linux dedicated/server-capable player, copy it to the Ubuntu host, then make the executable runnable:

```bash
chmod +x ./CXR_Backend.x86_64
```

Start a basic headless server:

```bash
./CXR_Backend.x86_64 -batchmode -nographics -logFile - --cxr-headless-server
```

Recommended validation command:

```bash
./CXR_Backend.x86_64 -batchmode -nographics -logFile - \
  --cxr-headless-server \
  --room-name "XR Dedicated Validation" \
  --max-participants 8 \
  --port 7777 \
  --metadata scenario=phase1 \
  --metadata environment=lan
```

> **Note**: Use space-separated arguments for values with spaces (`--room-name "Room A"`). PowerShell may split `--room-name="Room A"` on the space, causing parsing issues.

`-logFile -` sends Unity logs to terminal stdout. Keep the process attached to the terminal to watch startup logs, connection logs, registry publish warnings, and periodic headless server heartbeat logs until you terminate the server.

Log to a file:

```bash
./CXR_Backend.x86_64 -batchmode -nographics --cxr-headless-server --room-name="XR Dedicated Validation" --port=7777 -logFile ./cxr-server.log
```

## Environment Variables

The launcher also reads environment variables, which are useful for Ubuntu CLI deployment, systemd services, CI, or container entrypoints:

```bash
export CXR_HEADLESS_SERVER=1
export CXR_ROOM_NAME="XR Dedicated Validation"
export CXR_MAX_PARTICIPANTS=8
export CXR_PORT=7777
export CXR_PUBLIC_ADDRESS=203.0.113.10
export CXR_REGISTRY_URL=http://127.0.0.1:8080
export CXR_METADATA="scenario=phase1;environment=lan"

./CXR_Backend.x86_64 -batchmode -nographics -logFile -
```

Command-line arguments override environment defaults.

> **Note**: Stale environment variables from previous testing sessions can interfere. If you changed networks, verify or clear `CXR_REGISTRY_URL` with `[Environment]::SetEnvironmentVariable("CXR_REGISTRY_URL", $null, "User")` on Windows or `unset CXR_REGISTRY_URL` on Linux.

## Windows Command Line

Use a server build with:

```powershell
.\CXR_Backend.exe -batchmode -nographics -cxrHeadlessServer
```

For visible terminal logs in PowerShell, add `-logFile -`:

```powershell
.\CXR_Backend.exe -batchmode -nographics -logFile - -cxrHeadlessServer
```

Recommended validation command:

```powershell
.\CXR_Backend.exe -batchmode -nographics -logFile - `
  --cxr-headless-server `
  --room-name "XR Dedicated Validation" `
  --port 7777 `
  --public-address 192.168.1.100 `
  --registry-url http://192.168.1.100:8080 `
  --metadata scenario=phase1 `
  --metadata environment=lan
```

> **PowerShell note**: Use backtick `` ` `` for line continuation and space-separated arguments. Do not use `--registry-url=http://127.0.0.1:8080` inline — the `=`
> syntax with URLs can cause parsing issues. Use `--registry-url http://127.0.0.1:8080` instead.

## Supported Arguments

- `-cxrHeadlessServer`: explicitly starts the server path.
- `--cxr-headless-server`: Linux-style equivalent.
- `-server`: accepted as a shorter alias for explicit server start.
- `--server`: Linux-style equivalent.
- `-roomName <value>`: room name advertised over LAN discovery.
- `--room-name <value>` or `--room-name=<value>`: Linux-style equivalent.
- `-maxParticipants <value>`: advertised max participant count.
- `--max-participants <value>` or `--max-participants=<value>`: Linux-style equivalent.
- `-port <value>`: Mirror transport and discovery advertised port.
- `--port <value>` or `--port=<value>`: Linux-style equivalent.
- `-metadata <key=value>`: additional advertised metadata. Can be repeated.
- `--metadata <key=value>` or `--metadata=<key=value>`: Linux-style equivalent. Can be repeated.
- `--registry-url <url>` or `--registry-url=<url>`: HTTP room registry URL for multi-room hosting. If the URL contains `127.0.0.1`, `localhost`, or `0.0.0.0`, it is automatically resolved to the detected LAN IP by `RemoteRoomRegistryBrowser.NormalizeRegistryUrl`.
- `--public-address <ip-or-host>` or `--public-address=<ip-or-host>`: public address clients should use to connect to this room process. If omitted, the room IP is resolved from the publisher's fallback or auto-detected via `TryResolveLanAddress`.

## Expected Advertisement Metadata

The dedicated server path publishes normal runtime metadata plus:

- `serverMode=Dedicated`

Other metadata comes from `RuntimeSessionSdkBridge`, which writes metadata to `DiscoveryBroadcaster` only on initialization and session state changes (not every frame):

- `runtimeSessionState`
- `runtimeParticipantCount`
- `runtimeTrackedParticipantCount`
- `runtimeServerActive`
- `runtimeLayer`

When `--registry-url` is provided, the room is also published to the remote HTTP registry for client applications outside LAN discovery. The publisher sends a POST immediately on server start, whenever session state changes, and every `safetyHeartbeatSeconds` (default 30s) as a keepalive.

## Manual Validation

1. Build the project for Windows.
2. Launch one instance with the headless command.
3. Launch a normal client build on the same LAN.
4. Open the debug GUI or production room browser.
5. Refresh rooms.
6. Confirm the dedicated room appears with the configured room name and port.
7. Join the room.
8. Confirm participant count increments.
9. Disconnect the client.
10. Confirm participant cleanup and room metadata update.
11. Stop the server process.

## Troubleshooting

If the room is not visible via LAN discovery:

- Confirm both builds are on the same LAN.
- Confirm firewall rules allow UDP discovery and the Mirror transport port.
- Confirm the server process is running.
- Confirm the client and server use the same discovery port.
- Confirm `DiscoveryBroadcaster` has a valid explicit port or active transport.

If the room is not visible via the remote HTTP registry:

- Check the server terminal for `[REMOTE ROOM REGISTRY]` diagnostic logs. Common causes:
  - **"Publish skipped: no registry URL configured"**: `--registry-url` or `CXR_REGISTRY_URL` was not provided.
  - **"Publish deferred: server not active yet"**: The Mirror server is still starting. Logged up to `maxPublishRetries` (default 3) times, then abandoned.
  - **"Publish abandoned after N retries"**: The server never became active. Click "Advertise Room" in the debug GUI to retry.
  - **"Publish failed"**: HTTP error. Check that the registry server is running and reachable.
  - **"Publish skipped: DiscoveryBroadcaster.TryBuildResponse returned false"**: The broadcaster could not build a response. Ensure `explicitPort` is set on the `DiscoveryBroadcaster` component or a transport is active.
- Verify the registry server is running: `curl http://your-server:8080/health`.
- Check the registry server terminal. It logs every request: `POST /rooms -> 200`.

If the client cannot join:

- Confirm the advertised IP and port are reachable.
- Confirm no local server is already active on the client.
- Confirm the active transport port matches the advertised port.
- Confirm the server build has the session scene in build settings.

## Ubuntu Firewall Notes

If `ufw` is enabled on the Ubuntu server, allow the Mirror transport port and the discovery port used by `DiscoveryListener`.

Default runtime transport:

```bash
sudo ufw allow 7777/udp
sudo ufw allow 7777/tcp
```

Default discovery listener port in the current prefab:

```bash
sudo ufw allow 47777/udp
```

The exact transport protocol depends on the active Mirror transport. KCP primarily uses UDP.

## systemd Example

Example service file:

```ini
[Unit]
Description=CXR Headless Multiplayer Server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/cxr-server
Environment=CXR_HEADLESS_SERVER=1
Environment=CXR_ROOM_NAME=XR Dedicated Validation
Environment=CXR_MAX_PARTICIPANTS=8
Environment=CXR_PORT=7777
Environment=CXR_METADATA=scenario=phase1;environment=lan
ExecStart=/opt/cxr-server/CXR_Backend.x86_64 -batchmode -nographics -logFile /opt/cxr-server/cxr-server.log
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

## Automated Coverage

Editor tests cover:

- command-line parsing
- room name, participant count, port, and metadata application to discovery advertisement

Test file:

`Assets/Multiplayer/Tests/Editor/HeadlessServerLauncherTests.cs`
