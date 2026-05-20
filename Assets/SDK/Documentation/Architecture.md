# SDK Architecture

## Design Goals

- Lightweight and LAN-only.
- Reusable across multiple XR applications.
- Discovery-focused, not runtime-network focused.
- Minimal public API with operationally simple internals.

## Runtime Modules

### `DiscoveryManager`

Client-facing lifecycle coordinator. It:

- starts refresh cycles,
- listens for Mirror discovery responses,
- updates the room registry,
- removes stale rooms,
- exposes browser-facing events.

### `DiscoveryListener`

Mirror Discovery integration point. It:

- sends discovery requests,
- receives room advertisements,
- forwards valid responses into the SDK pipeline.

### `DiscoveryBroadcaster`

Server/host-side advertisement helper. It:

- publishes room metadata,
- resolves transport port information,
- periodically re-advertises room visibility.

### `RoomRegistry`

In-memory room cache. It:

- tracks active rooms,
- deduplicates repeated discovery packets,
- removes stale entries after timeout,
- returns immutable snapshots for UI/browser workflows.

### `RoomMetadataManager`

Small metadata container for server-side room attributes such as environment, mode, scenario, or institution-specific labels.

### `TransportPortHelper`

Utility for reading and writing the transport port on Mirror `Transport` instances. Used by both `DiscoveryBroadcaster` (to read the port for advertisements) and `JoinRoomHandler` (to set the client port before connecting). Eliminates fragile reflection patterns previously duplicated in those components.

### `JoinRoomHandler`

Join handoff layer. It:

- looks up the selected room,
- assigns the target IP address to `NetworkManager`,
- tries to push the discovered port into the active Mirror transport,
- starts the Mirror client.

The SDK responsibility ends there.

## Discovery Lifecycle

1. Mirror host or dedicated server starts separately.
2. `DiscoveryBroadcaster` advertises metadata through `DiscoveryListener`.
3. Client `DiscoveryManager` refreshes LAN discovery.
4. `DiscoveryListener` receives discovery responses.
5. `RoomRegistry` upserts room metadata and filters duplicates.
6. Browser/UI layers react through `RoomsChanged`.
7. User picks a room.
8. `JoinRoomHandler` initiates the Mirror connection.

## Duplicate Filtering

The registry uses `RoomId` as the primary identity key and falls back to `IpAddress:Port` when needed. Endpoint collisions replace stale or superseded entries so repeated broadcasts do not grow duplicate room rows.

## Stale Cleanup

Each room stores `LastSeen`. The manager runs periodic cleanup and removes entries whose last advertisement is older than the configured timeout.
