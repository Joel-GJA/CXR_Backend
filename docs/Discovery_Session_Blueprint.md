# Discovery and Session Blueprint

## Purpose

The discovery and session systems work together to expose LAN rooms with runtime state. Discovery answers "what rooms exist?" while session answers "what is happening inside the active runtime?"

## Key Prefabs and Components

On `XRNetworkManager.prefab`:

- `DiscoveryListener`
- `DiscoveryBroadcaster`
- `DiscoveryManager`
- `JoinRoomHandler`
- `RuntimeSessionManager`
- `RuntimeSessionSdkBridge`
- `XRNetworkManager`

On `XRMultiplayerDebugGUI.prefab`:

- `XRRoomDiscoveryLifecycle`
- `XRMultiplayerRuntimeFacade`
- `XRMultiplayerDebugGUI`

## Room Discovery Runtime

`XRRoomDiscoveryLifecycle` wraps the lower-level SDK discovery manager and exposes app-friendly state.

Use it through `XRMultiplayerRuntimeFacade` unless you are writing infrastructure code.

State exposed:

- current discovery state
- last error
- last refresh time
- visible room count
- visible rooms

Commands exposed:

- `Initialize`
- `StartDiscovery`
- `RefreshRooms`
- `StopDiscovery`
- `JoinRoom`
- `GetRoomById`

## Room Metadata

`RuntimeSessionSdkBridge` publishes runtime metadata into room advertisements. It subscribes to `RuntimeSessionManager` events and writes to `DiscoveryBroadcaster` only on initialization and when the session state changes (not every frame):

- `runtimeSessionState`
- `runtimeParticipantCount`
- `runtimeTrackedParticipantCount`
- `runtimeServerActive`
- `runtimeLayer`

> **Note**: `RuntimeSessionManager` no longer writes directly to `DiscoveryBroadcaster`. The `PublishDiagnostics()` method and its `DiscoveryBroadcaster` serialized field were removed in favor of the dedicated bridge component.

Additional metadata can be written with:

```csharp
discoveryBroadcaster.SetMetadata("scenarioId", scenarioId);
discoveryBroadcaster.SetMetadata("environment", environmentName);
```

## Session Runtime

`RuntimeSessionManager` is server-side and tracks:

- current session state
- active participants
- tracked participant info
- participant netIds by connection ID
- disconnect cleanup policy

It raises events for:

- session state changes
- participant registration
- participant unregistration

Events are consumed by `RuntimeSessionSdkBridge` (for LAN metadata) and `RemoteRoomRegistryPublisher` (for HTTP registry updates).

## Host Flow

1. Start host or server through the facade or debug GUI.
2. `XRNetworkManager` starts the Mirror server.
3. `RuntimeSessionManager` begins the server session.
4. `RuntimeSessionSdkBridge` updates room metadata.
5. `DiscoveryBroadcaster` advertises the room on LAN.

## Browser Flow

1. Start or refresh discovery through the facade.
2. `XRRoomDiscoveryLifecycle` enters `Refreshing`.
3. `DiscoveryManager` sends a discovery request.
4. Room responses update `RoomRegistry`.
5. The facade exposes rooms through `VisibleRooms`.

## Join Flow

1. UI passes a selected room ID to `JoinRoom`.
2. `XRRoomDiscoveryLifecycle` validates the room.
3. `DiscoveryManager` delegates join to `JoinRoomHandler`.
4. `JoinRoomHandler` configures the Mirror address and transport port.
5. Mirror starts the client connection.

## Failure Handling

Join calls return `false` and populate an error string when:

- discovery manager is unavailable
- selected room is missing
- room lacks a valid IP/port
- Mirror network manager is missing
- a local server is already active and join is blocked

Production UI should surface these errors to developers or users as appropriate.

## Developer Rules

- Use discovery for room browsing, not for gameplay state replication.
- Use room metadata for lightweight session descriptors only.
- Do not put large or sensitive data in discovery metadata.
- Use `RuntimeSessionManager` for participant lifecycle.
- Use Mirror network messages or SyncVars for gameplay synchronization.

