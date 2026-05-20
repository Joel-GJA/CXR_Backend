# LAN Testing Workflow

## Windows-First Local Validation

This package was created entirely inside:

`D:\CXR Main Backend\CXR_SDK`

Use that path as the package source during development.

## Suggested Test Matrix

### Single-Machine Editor Test

1. Open a host scene in the Unity Editor.
2. Start Mirror host or server runtime.
3. Ensure `DiscoveryBroadcaster` is active.
4. Open a client scene in another Editor instance or a standalone build.
5. Ensure `DiscoveryManager` is in the scene and initialized (it initializes on Awake by default).
6. Confirm the room appears in the browser UI.
7. Join the discovered room.

### Multi-Client LAN Visibility Test

1. Start one host on the LAN.
2. Start two or more client machines on the same subnet.
3. Confirm each client sees the same room metadata.
4. Refresh repeatedly and confirm duplicate rows do not appear.

### Stale Session Cleanup Test

1. Start the host and confirm visibility on clients.
2. Stop the host or disconnect it from the LAN.
3. Wait longer than `staleTimeoutSeconds`.
4. Confirm the room disappears from the browser list.

### Headless Dedicated Server Test

1. Create a Windows headless build with Mirror server scene content.
2. Add `SampleHeadlessServerLauncher`.
3. Run the build with `-batchmode -nographics`.
4. Confirm clients detect the room through LAN discovery.

## Validation Targets

- automatic LAN room discovery works
- repeated refreshes remain stable
- room metadata stays consistent
- stale rooms are removed predictably
- duplicate advertisements do not create duplicate UI entries
- multiple clients can observe the same room
- join handoff passes the discovered address and port to Mirror
