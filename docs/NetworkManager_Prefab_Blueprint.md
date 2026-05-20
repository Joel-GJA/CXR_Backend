# XRNetworkManager Prefab Blueprint

## Purpose

`XRNetworkManager.prefab` is the reusable root of the multiplayer foundation. It owns Mirror lifecycle, runtime session setup, discovery wiring, transport selection, and spawn prefab registration.

Prefab path:

`Assets/Multiplayer/Prefab/XRNetworkManager.prefab`

Script:

`Assets/Multiplayer/Core/Network/XRNetworkManager.cs`

## Responsibilities

`XRNetworkManager` is responsible for:

- configuring Mirror offline and online scenes
- assigning the preferred transport and `Transport.active`
- resolving or creating runtime infrastructure
- resolving or creating discovery infrastructure
- starting and stopping server session state
- tracking connected server clients
- forwarding disconnects to session cleanup
- registering default runtime spawn prefabs

## Required Components

The prefab should include:

- `XRNetworkManager`
- KCP transport
- `RuntimeSessionManager`
- `RuntimeDiagnostics`
- `RuntimeSessionSdkBridge`
- `DiscoveryListener`
- `DiscoveryBroadcaster`
- `DiscoveryManager`
- `JoinRoomHandler`
- `HeadlessServerLauncher`

## Inspector Sections

### Scene Flow

- `lobbyScene`: scene used when offline or returning to lobby.
- `sessionScene`: scene used when the session is active.
- `configureSceneFlowOnAwake`: writes the configured scenes into Mirror fields on awake.

### Transport

- `preferredTransport`: Mirror transport to use.
- `assignActiveTransportOnAwake`: assigns `Transport.active`.

### Runtime Session

- `sessionManager`: participant/session registry.
- `autoCreateRuntimeComponents`: creates missing runtime infrastructure on the manager object.

### Discovery

- `enableSdkDiscoveryBridge`: enables SDK room advertisement integration.
- `sessionSdkBridge`: publishes runtime metadata to discovery.
- `discoveryListener`: receives and sends discovery traffic.
- `discoveryBroadcaster`: publishes room metadata.
- `autoCreateDiscoveryComponents`: creates missing discovery infrastructure on the manager object.

**Single resolution point**: `XRNetworkManager` is the only component that resolves `DiscoveryBroadcaster` and `DiscoveryListener` (via `ResolveDiscoveryComponents()`). It then injects them into `RuntimeSessionSdkBridge`, `RemoteRoomRegistryPublisher`, and `HeadlessServerLauncher` through `Initialize()` methods. These sub-components no longer call `GetComponent`/`FindObjectOfType` for SDK discovery references.

**Connection state isolation**: `XRConnectionStateProvider` is a non-MonoBehaviour class that wraps all Mirror static reads (`NetworkServer.active`, `NetworkClient.isConnected`, `NetworkClient.localPlayer`, `NetworkManager.singleton`). `XRMultiplayerRuntimeFacade` uses the provider instead of importing Mirror directly, ensuring that Mirror internals are not exposed through the public API boundary.

### Runtime Spawn Prefabs

- `registerDefaultResourceSpawnPrefab`: registers the configured Resources prefab.
- `defaultResourceSpawnPrefabPath`: default Resources path.
- `runtimeSpawnPrefabs`: additional prefabs Mirror should know how to spawn.

### Headless Server

- `autoStartInBatchMode`: starts server mode automatically for batchmode builds.
- `defaultRoomName`: advertised room name when no command-line override is provided.
- `defaultMaxParticipants`: advertised capacity when no command-line override is provided.
- `defaultPort`: transport and advertised port when no command-line override is provided.
- `markAsDedicatedServer`: publishes dedicated server metadata.

## Lifecycle Hooks

### Awake

Configures transport, scenes, runtime infrastructure, discovery, and spawn prefabs.

### OnStartServer

Starts the runtime session and publishes discovery advertisement metadata.

### OnStopServer

Shuts down the runtime session, clears connected clients, and marks server inactive.

### OnServerConnect

Tracks connected clients by Mirror connection ID.

### OnServerDisconnect

Forwards disconnects to `RuntimeSessionManager` so participants and owned entities are cleaned up.

## Developer Rules

- Put one `XRNetworkManager` in the entry/lobby scene.
- Use the prefab instead of creating a new Mirror manager from scratch.
- Assign your app-specific player prefab if you replace `XRRuntimeParticipantRoot`.
- Keep custom app behavior outside the manager unless it is lifecycle infrastructure.
- Register any network-spawned runtime prefab in `runtimeSpawnPrefabs`.
