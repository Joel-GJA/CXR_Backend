# Multiplayer Foundation Architecture

## Purpose

The Phase 1 multiplayer foundation turns the prototype into a reusable Unity and Mirror package for LAN-based XR sessions. The intended consumer is an XR application team that wants to import the package, place the provided prefabs in a scene, assign app-specific content, and receive a working baseline for:

- Mirror host, client, and server lifecycle.
- LAN room discovery and join.
- Runtime session state and room metadata.
- Participant registration and disconnect cleanup.
- Networked runtime entity ownership and lifecycle.
- A debug GUI that demonstrates the production-facing runtime API.

Phase 1 is not intended to solve full XR body, hand, avatar, or gameplay synchronization. It defines the operational foundation those systems will use in later phases.

## Architectural Principles

- Infrastructure owns lifecycle. App teams should not duplicate connection, discovery, registration, or cleanup logic.
- App teams own content. Participant visuals, input rigs, interactions, and scenario-specific objects should attach through documented extension points.
- Debug UI is a blueprint. It demonstrates how to build app UI on the public facade, but it is not the final branded UI.
- SDK discovery stays reusable. The lower-level LAN discovery SDK remains available, while the multiplayer layer adds session-aware lifecycle and metadata.
- Mirror remains the transport/runtime authority. The package wraps Mirror patterns without hiding the fact that Mirror is the networking backend.

## Runtime Layers

### SDK Discovery Layer

Location: `Assets/SDK/Runtime`

This layer discovers LAN rooms and initiates joins. It is intentionally independent from gameplay code.

Key types:

- `DiscoveryManager`: client-side discovery lifecycle coordinator.
- `DiscoveryListener`: Mirror discovery integration point for requests and responses.
- `DiscoveryBroadcaster`: host/server advertisement helper.
- `RoomRegistry`: in-memory room cache with duplicate replacement and stale cleanup.
- `RoomInfo`: room snapshot returned to browsers and UI.
- `JoinRoomHandler`: assigns Mirror target address/port and starts a client.

### Multiplayer Runtime Layer

Location: `Assets/Multiplayer/Core`

This layer turns raw Mirror and SDK pieces into a reusable multiplayer runtime pattern.

Key types:

- `XRNetworkManager`: the main Mirror network manager prefab script.
- `RuntimeSessionManager`: server-side participant/session registry.
- `RuntimeSessionSdkBridge`: publishes runtime session metadata into LAN discovery advertisements.
- `XRRoomDiscoveryLifecycle`: developer-facing room discovery state machine.
- `XRMultiplayerRuntimeFacade`: app-facing runtime API for UI and tools.
- `XRRoomBrowserModel`: UI-safe room list and discovery snapshot model.
- `RuntimeParticipant`: base player/session participant.
- `RuntimeParticipantInstaller`: standard participant prefab configuration helper.
- `RuntimeEntity`: base behavior for networked runtime objects.
- `RuntimeEntityRegistry`: server-side runtime entity lookup.
- `RuntimeSpawnService`: server-side spawn/despawn helper.
- `RuntimeDiagnostics`: session snapshot and logging helper.
- `HeadlessServerLauncher`: dedicated server launcher for batchmode and command-line configured server runs.
- `XRMultiplayerDebugGUI`: immediate-mode debug GUI built on the facade.

### Prefab Layer

Location: `Assets/Multiplayer/Prefab`

The prefab layer gives teams concrete importable assets:

- `XRNetworkManager.prefab`: complete Mirror manager with KCP, runtime session, discovery, diagnostics, and registered spawn prefabs.
- `XRMultiplayerDebugGUI.prefab`: debug and blueprint UI for connection, discovery, rooms, and session state.
- `XRRuntimeParticipantRoot.prefab`: standard participant root with network components and XR extension anchors.
- `RuntimeEntity.prefab`: minimal runtime object baseline.
- `NetworkInteractableCube.prefab`: sample networked interactable entity pattern.

## Lifecycle Overview

### Host or Server Start

1. `XRNetworkManager.Awake` configures transport, scene flow, runtime components, discovery components, and spawn prefabs. It resolves `DiscoveryBroadcaster` and `DiscoveryListener` once in `ResolveDiscoveryComponents()`, then injects them into all sub-components (`RuntimeSessionSdkBridge`, `RemoteRoomRegistryPublisher`, `HeadlessServerLauncher`) via `Initialize()` methods — eliminating duplicate `GetComponent` calls.
2. `XRNetworkManager.OnStartServer` marks the server active.
3. `RuntimeSessionManager.BeginServerSession` clears previous state and enters `WaitingForParticipants`.
4. `RuntimeSessionSdkBridge` publishes room metadata through `DiscoveryBroadcaster` (sole publisher — session state and participant metadata flow through the bridge's event subscriptions, not through `RuntimeSessionManager` directly).
5. `DiscoveryBroadcaster` advertises room name, status, participant counts, and runtime metadata.

### Dedicated Headless Start

1. A server build starts with `-batchmode -nographics` and optionally `-cxrHeadlessServer`.
2. `HeadlessServerLauncher` delegates to `CommandLineParser.Parse()` for environment variable and command-line configuration (room name, participant capacity, port, metadata, registry URL, public address).
3. The launcher configures the Mirror transport, `DiscoveryBroadcaster`, and `RuntimeSessionSdkBridge`.
4. The launcher starts Mirror server mode.
5. The normal server session and discovery advertisement flow continues through `XRNetworkManager`.

### Client Room Discovery

1. UI calls `XRMultiplayerRuntimeFacade.StartDiscovery` or `RefreshRooms`.
2. The facade forwards to `XRRoomDiscoveryLifecycle`.
3. `XRRoomDiscoveryLifecycle` initializes and refreshes `DiscoveryManager`.
4. `DiscoveryManager` requests LAN discovery through `DiscoveryListener`.
5. `RoomRegistry` upserts discovered `RoomInfo` entries.
6. `XRRoomBrowserModel` exposes the current visible room list to UI.

### Join Flow

1. UI calls `XRMultiplayerRuntimeFacade.JoinRoom(roomId, out error)`.
2. The facade forwards to `XRRoomDiscoveryLifecycle`.
3. `XRRoomDiscoveryLifecycle` validates the room and enters `Joining`.
4. `DiscoveryManager.JoinRoom` delegates to `JoinRoomHandler`.
5. `JoinRoomHandler` assigns `NetworkManager.networkAddress`, tries to set the transport port, and starts the Mirror client.
6. On success, discovery state enters `Joined`.

### Participant Registration

1. Mirror spawns the player prefab.
2. `RuntimeParticipant.OnStartServer` finds the active `RuntimeSessionManager`.
3. `RuntimeSessionManager.RegisterParticipant` initializes and activates the participant.
4. Participant info is stored by participant netId and connection ID.
5. Session state transitions to `Active`.
6. `RuntimeSessionSdkBridge` republishes runtime metadata to discovery (via `ParticipantRegistered` event).

### Disconnect Cleanup

1. `XRNetworkManager.OnServerDisconnect` forwards the connection to `RuntimeSessionManager`.
2. `RuntimeSessionManager` resolves the participant for the connection.
3. Owned runtime entities are either despawned or released, depending on configuration.
4. The participant is unregistered.
5. If no participants remain, session state returns to `WaitingForParticipants`.

## Runtime State Models

### Connection State

`XRConnectionLifecycle` describes the current Mirror mode:

- `Offline`
- `ClientConnecting`
- `ClientConnected`
- `ServerActive`
- `HostActive`

### Discovery State

`XRRoomDiscoveryLifecycleState` describes room discovery and join state:

- `Idle`
- `Initializing`
- `Refreshing`
- `RoomsAvailable`
- `NoRooms`
- `Joining`
- `Joined`
- `Failed`
- `Stopped`

### Session State

`RuntimeSessionState` describes the active server runtime:

- `WaitingForParticipants`
- `Initializing`
- `Active`
- `ShuttingDown`

### Entity State

`RuntimeEntityState` describes networked runtime object lifecycle:

- `Created`
- `Registered`
- `Initialized`
- `Active`
- `CleaningUp`
- `Destroyed`

## Public API Boundary

Application UI should prefer `XRMultiplayerRuntimeFacade` instead of calling random infrastructure components directly. The facade reads all Mirror connection state through `XRConnectionStateProvider` (which wraps `NetworkServer`/`NetworkClient` statics) — UI code never touches Mirror internals.

The facade exposes:

- Current connection state.
- Current network address.
- Discovery availability and room list.
- Session state and participant counts.
- Local player netId and connection diagnostics.
- `StartHost`.
- `StartServer`.
- `StartClient`.
- `StartDiscovery`.
- `RefreshRooms`.
- `StopDiscovery`.
- `JoinRoom`.
- `StopClient`.
- `Stop`.

The debug GUI follows this rule and is the reference implementation for UI authors.

## Extension Points

### Participant Content

Use `XRRuntimeParticipantRoot.prefab` as the player/session participant base. Add app-specific systems under:

- `HeadRoot`
- `LeftHandRoot`
- `RightHandRoot`
- `RigMount`
- `AvatarVisualRoot`

### Runtime Objects

Networked objects that participate in runtime lifecycle should derive from or compose `RuntimeEntity`. Use server-side methods for ownership, initialization, activation, cleanup, spawn, and despawn.

### Room Metadata

Use `DiscoveryBroadcaster.SetMetadata` or `RuntimeSessionSdkBridge` to publish app-specific metadata. Examples:

- scenario ID
- environment name
- organization or cohort
- app version
- capacity policy
- runtime session state

### UI

Build custom UI against `XRMultiplayerRuntimeFacade` and `XRRoomBrowserModel`. The debug GUI can be copied as a structural example, but production UI should supply app-specific visuals and input patterns.

## Current Boundaries

- The package is LAN-first.
- The default transport is KCP through Mirror.
- Full XR hand/head sync is reserved for later work.
- Dedicated headless launch support is implemented through `HeadlessServerLauncher`; full Ubuntu CLI build-to-client validation still needs to be performed on target machines.
- `RuntimeSceneFlow` is currently a placeholder and should not be treated as a production scene controller.
- `RuntimePrefabRegistry` is currently a serialized container only; active registration happens through `XRNetworkManager`.

## Development Notes

The foundation has evolved from a scene-specific prototype toward a reusable package. The key development movement has been:

1. Separate SDK discovery from multiplayer runtime.
2. Centralize Mirror lifecycle in `XRNetworkManager`.
3. Track participants through `RuntimeSessionManager`.
4. Publish runtime state into discovery advertisements.
5. Add `XRRoomDiscoveryLifecycle` for developer-facing room discovery state.
6. Add `XRMultiplayerRuntimeFacade` so UI can be built against stable hooks.
7. Standardize participant and entity prefabs for future app teams.
