# Runtime Facade and Debug GUI Blueprint

## Purpose

The runtime facade is the production-facing API for UI and tools. The debug GUI is a development-only example of how to consume that API.

Facade script:

`Assets/Multiplayer/Core/Lifecycle/XRMultiplayerRuntimeFacade.cs`

Debug GUI script:

`Assets/Multiplayer/Core/UI/XRMultiplayerDebugGUI.cs`

Debug GUI prefab:

`Assets/Multiplayer/Prefab/XRMultiplayerDebugGUI.prefab`

## Why This Layer Exists

The debug GUI should not directly poke random Mirror or discovery internals. Production apps need stable hooks that can be used by branded UI, XR controls, automated validation tools, or editor diagnostics.

`XRMultiplayerRuntimeFacade` provides those hooks. All Mirror connection state reads (`NetworkServer.active`, `NetworkClient.isConnected`, `NetworkClient.localPlayer`) are isolated in `XRConnectionStateProvider`; the facade itself never imports Mirror.

The facade no longer resolves its own dependencies at runtime (`FindObjectOfType`/`GetComponent` were removed alongside the per-frame `Update()` loop). Instead, it requires `XRNetworkManager`, `XRRoomDiscoveryLifecycle`, and `RemoteRoomRegistryBrowser` references assigned in the Inspector — or injected via `Initialize(XRConnectionStateProvider)` for tests. Without assigned references, lifecycle commands silently no-op, but state properties (connection, session) remain functional via the internally created `XRConnectionStateProvider`.

## Facade Read Model

Use these properties to display state:

- `ConnectionState`
- `IsServerActive`
- `IsClientConnected`
- `IsClientConnecting`
- `IsDiscoveryAvailable`
- `SessionState`
- `ParticipantCount`
- `TrackedParticipantCount`
- `ConnectedClientCount`
- `LocalPlayerNetId`
- `LocalConnectionId`
- `NetworkAddress`
- `VisibleRooms`
- `RoomBrowser`

`RoomBrowser` is an `XRRoomBrowserModel` snapshot with:

- visible rooms
- discovery state
- last error
- last refresh time
- visible room count

## Facade Commands

Use these methods to drive runtime lifecycle:

- `StartHost()`
- `StartServer()`
- `StartClient(string address)`
- `StartDiscovery()`
- `RefreshRooms()`
- `StopDiscovery()`
- `JoinRoom(string roomId, out string error)`
- `StopClient()`
- `Stop()`
- `GetRoomById(string roomId)`

## Debug GUI Behavior

The debug GUI displays:

- connection mode
- current network address
- direct client address entry
- host/server/client/stop controls
- discovery state
- visible room count
- last refresh time
- discovery error
- room list and join buttons
- session state
- participant counts
- local player netId
- connection diagnostics

## Production UI Guidance

Build production UI against the facade, not against:

- `NetworkManager.singleton`
- `NetworkServer`
- `NetworkClient`
- `DiscoveryManager`
- `DiscoveryListener`
- `DiscoveryBroadcaster`

Those lower-level APIs remain available for infrastructure work, but normal app UI should stay at the facade boundary.

## Example Production Flow

1. User opens room browser.
2. UI calls `StartDiscovery`.
3. UI reads `RoomBrowser.VisibleRooms`.
4. User selects a room.
5. UI calls `JoinRoom(roomId, out error)`.
6. UI displays `error` if join initiation fails.
7. Runtime scene loads through Mirror scene flow.

