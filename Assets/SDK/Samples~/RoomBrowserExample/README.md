# Room Browser Example

This sample provides scripts only so it can be imported into an existing project without forcing scene assets.

## Suggested Scene Wiring

### Client Scene

Create a `RoomBrowserRoot` object with:

- `DiscoveryManager`
- `SampleRoomBrowserBootstrap`
- `SampleRoomBrowserUI`

Wire `SampleRoomBrowserUI` to:

- a `VerticalLayoutGroup` content root
- a `SampleRoomListItemView` prefab
- a refresh `Button`
- a status `Text`

### Host or Server Scene

Create a `RoomHostRoot` object with:

- `NetworkManager`
- KCP or another Mirror transport
- `DiscoveryListener`
- `DiscoveryBroadcaster`
- `SampleRoomServerMetadata`

Optional for dedicated server builds:

- `SampleHeadlessServerLauncher`

## Sample Flow

1. Start the host or dedicated server.
2. Start the client scene.
3. The bootstrap initializes the SDK and requests discovery.
4. The UI redraws whenever `RoomsChanged` fires.
5. Clicking Join hands off to Mirror through `CXRSDK.JoinRoom(...)`.
