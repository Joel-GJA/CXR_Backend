# Example Scenes Blueprint

## Purpose

Phase 1 example scenes should demonstrate the intended architecture rather than final app gameplay. They exist so app teams can inspect the package, run a known host/client flow, and copy the setup pattern into their own XR application.

## Current Scene Roles

### Lobby Scene

Path:

`Assets/Multiplayer/Scenes/LobbyScene.unity`

Purpose:

- entry point for app teams
- contains or references the multiplayer manager and debug/browser UI
- starts host, server, client, and discovery flows
- returns users after leaving a session

Expected foundation objects:

- `XRNetworkManager`
- `XRMultiplayerDebugGUI`

### Session Scene

Path:

`Assets/Multiplayer/Scenes/SessionScene.unity`

Purpose:

- active multiplayer runtime scene
- demonstrates participant spawning
- demonstrates runtime entity spawning
- gives a simple shared space for host/client validation

Expected foundation behavior:

- Mirror spawns `XRRuntimeParticipantRoot`
- participants register with `RuntimeSessionManager`
- runtime entities can be spawned through `RuntimeSpawnService`
- disconnect cleanup can be observed

### XR Presence Test Scene

Path:

`Assets/Multiplayer/Scenes/XRPresenceTestScene.unity`

Purpose:

- validates XR head/controller sync and body visualization
- contains XR Origin rig, XRNetworkManager, XRTrackingBridge, debug GUI, and an interactable cube
- `configureSceneFlowOnAwake` is set to 0 — no automatic scene transitions
- suitable for two-client sync validation in-editor with XR Device Simulator

### Testing Scenes

Path:

`Assets/Multiplayer/Testing/Scene`

Purpose:

- focused validation scenes for discovery and runtime lifecycle
- not intended as production app scenes
- useful for isolating host/client and discovery behavior

## Final Example Scene Criteria

Before Phase 1 is signed off, the example scenes should allow a developer to validate:

- launch into the lobby scene
- start host from debug GUI
- transition to session scene
- launch a second client
- discover the host or dedicated server
- join the room
- see participant count update
- spawn a runtime entity
- disconnect a client
- confirm participant and owned entity cleanup
- stop host/server and return to lobby

## Build Settings

The lobby, session, and XR presence test scenes should be enabled in `ProjectSettings/EditorBuildSettings.asset`.

Recommended order:

1. `Assets/Multiplayer/Scenes/LobbyScene.unity`
2. `Assets/Multiplayer/Scenes/SessionScene.unity`
3. `Assets/Multiplayer/Scenes/XRPresenceTestScene.unity`

Testing scenes can remain available for developers, but they do not need to be first in the production build order.

## Phase 2 Guidance — XR Presence

When creating an XR multiplayer scene:

- Add an `XRTrackingBridge` GameObject — it auto-wires to the XR Origin.
- Run `Tools/XR Presence/Auto-Wire Tracking Bridge` from the menu.
- Run `Tools/XR Presence/Validate Current Scene` to verify setup.
- Set `configureSceneFlowOnAwake = 0` on `XRNetworkManager` if you want to control scene transitions manually.
- Use keyboard fallback (T) for sync testing without XR hardware.

## App-Team Guidance

Use the example scenes to learn the architecture, then create app-specific scenes with the same foundation:

- one lobby/browser scene
- one or more runtime/session scenes
- one `XRNetworkManager`
- one UI layer built on `XRMultiplayerRuntimeFacade`
- one participant prefab derived from `RuntimeParticipant`
- app-specific runtime entities derived from or composed with `RuntimeEntity`

