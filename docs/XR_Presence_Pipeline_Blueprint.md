# XR Presence Pipeline Blueprint

## Purpose

The XR presence pipeline synchronizes a user's headset and controller transforms from their local XR rig to all remote clients. It is the multiplayer representation layer — how a player exists, appears, and updates in a shared XR environment.

Prefab:

`Assets/Multiplayer/Prefab/XRRuntimeParticipantRoot.prefab`

Scripts:

- `Assets/Multiplayer/Core/Runtime/XRTrackingBridge.cs`
- `Assets/Multiplayer/Core/Runtime/XRRuntimeParticipant.cs`
- `Assets/Multiplayer/Core/Runtime/XRParticipantRuntime.cs`
- `Assets/Multiplayer/Core/Runtime/XRHandPhysicsContactProxy.cs`
- `Assets/Multiplayer/Core/Runtime/XRBodyPhysicsContactProxy.cs`
- `Assets/Multiplayer/Core/Runtime/RuntimeParticipant.cs`

---

## Data Flow

```
Local XR Headset/Controllers
        ↓
XRTrackingBridge (reads XR Origin transforms)
        ↓
XRRuntimeParticipantRoot (NetworkTransform writes)
        ↓  (ClientToServer, 20 Hz)
Server relays to remote clients
        ↓
Remote XRRuntimeParticipantRoot instances
        ↓
HeadProxy / HandProxy spheres (visible only on remote)
```

Local client: XR tracking → `XRTrackingBridge` → `NetworkTransform` → server.

Remote clients: server → `NetworkTransform` → proxy sphere position updates.

---

## Architecture Overview

### Server Contact Proxies

`XRParticipantRuntime` now creates lightweight server-only contact proxies for left hand, right hand, and body.

These proxies are:

- invisible
- kinematic trigger volumes
- driven from replicated hand transforms
- used only for authoritative passive contact with dynamic objects

The hand proxies use sphere triggers. The body proxy uses a capsule trigger.

The body proxy uses a capsule shape driven from the participant root so locomotion can nudge idle objects without turning the avatar into a fully simulated character body.

They are not visual hands, not ownership objects, and not full avatar physics bodies.

Remote participants currently receive stronger passive-contact multipliers than host participants to better match real-world feel across the networked path.

### XRTrackingBridge

`XRTrackingBridge` is the bridge between the local XR rig (XR Origin) and the networked player prefab. It runs at `DefaultExecutionOrder(-100)` to execute before other `LateUpdate` callers.

Responsibilities:

- Reads headset transform from the XR Origin camera.
- Reads left/right controller transforms from `ActionBasedController` components.
- Writes transforms to `XRParticipantRuntime.HeadTransform`, `.LeftHandTransform`, `.RightHandTransform`.
- Syncs root body position (head Y - bodyHeightOffset) + yaw-only rotation.
- Provides keyboard fallback mode (press T) for debug/testing without XR hardware.
- Resolves both `Camera Offset` and `CameraOffset` XR rig naming when entering keyboard fallback mode.

### Local vs Remote Separation

`XRParticipantRuntime` (on the player prefab) separates local and remote behavior:

| Event | Local Player | Remote Player |
|-------|-------------|---------------|
| `OnStartLocalPlayer()` | Hides head/hand proxy spheres | — |
| `OnStartClient()` (not local) | — | Shows head/hand proxy spheres |
| `OnStopClient()` | Cleanup | Cleanup |

The local player sees their own XR Origin directly and never sees their own proxy spheres. Remote players see proxy spheres at the synced positions.

### Prefab Structure

```
XRRuntimeParticipantRoot (GameObject)
  ├── NetworkIdentity
  ├── NetworkTransformReliable (syncs root/body position — ClientToServer, 20 Hz)
  ├── XRRuntimeParticipant (resolves HeadRoot/LeftHandRoot/RightHandRoot)
  ├── XRParticipantRuntime (local/remote separation, proxy visibility)
  ├── RigMount
  │   └── AvatarVisualRoot
  │       └── Capsule (basic body visualization)
  ├── HeadRoot (position: 0, 1.6, 0)
  │   ├── NetworkTransform (syncs head — ClientToServer, 20 Hz, Teleport)
  │   └── HeadProxy (sphere, disabled for local player)
  ├── LeftHandRoot (position: -0.35, 1.1, 0.25)
  │   ├── NetworkTransform (syncs left hand — ClientToServer, 20 Hz, Teleport)
  │   └── LeftHandProxy (sphere, disabled for local player)
  └── RightHandRoot (position: 0.35, 1.1, 0.25)
      ├── NetworkTransform (syncs right hand — ClientToServer, 20 Hz, Teleport)
      └── RightHandProxy (sphere, disabled for local player)
```

### Root Body Sync (Option D)

The root `NetworkTransformReliable` on `XRRuntimeParticipantRoot` syncs the body position. `XRTrackingBridge` sets it each frame:

```
root.position = headSource.position + Vector3.down * bodyHeightOffset
root.rotation  = Quaternion.Euler(0f, headSource.eulerAngles.y, 0f)
```

`bodyHeightOffset` defaults to **1.6** and is configurable in the Inspector.

The Capsule child under `AvatarVisualRoot` sits at local (0, 0, 0) inside the root, so it moves with the root position and provides basic body visualization.

### NetworkTransform Settings

All XR presence `NetworkTransform` components use these settings:

| Setting | Root | Head/Hand Children |
|---------|------|--------------------|
| syncDirection | ClientToServer | ClientToServer |
| syncInterval | 0.05 (20 Hz) | 0.05 (20 Hz) |
| interpolatePosition | true | true |
| interpolateRotation | true | true |
| interpolateScale | false | false |
| onlySyncOnChange | true | true |
| updateMethod | Normal (0) | Teleport (2) |
| positionPrecision | 0.001 | 0.001 |
| rotationSensitivity | 0.01 | 0.01 |

---

## Auto-Wire (Editor Tooling)

`XRTrackingBridge.AutoWire()` scans the scene at runtime or via the Inspector button and resolves:

1. **XR Origin** — searches by name: `"XR Origin (XR Rig)"` → `"XR Origin"` → falls back to any `XROrigin` component.
2. **Head source** — first `Camera` child of the XR Origin, or `Camera Offset/Main Camera` path.
3. **Controller sources** — `ActionBasedController` children matching `"Left"`/`"Right"` in name, or standard paths.

If references are null at `Start()`, `AutoWire()` is called automatically.

The custom Inspector (`XRTrackingBridgeEditor`) provides an **Auto-Wire From Scene** button and shows a help box when references are missing.

### XRPresenceValidator

`XRPresenceValidator` (Editor-only) validates scenes for XR presence requirements:

- `Tools/XR Presence/Validate Current Scene` — checks for XR Origin, camera, controllers, tracking bridge wiring, NetworkManager player prefab, no scene-placed XRRuntimeParticipant instances.
- `Tools/XR Presence/Auto-Wire Tracking Bridge` — finds and wires an existing `XRTrackingBridge` in the scene.

---

## Keyboard Fallback Mode

Press **T** to toggle between XR device tracking and keyboard/mouse control.

| Control | Action |
|---------|--------|
| WASD / Arrow keys | Move forward/back/left/right |
| Mouse look | Look around (cursor locked) |
| T | Toggle mode |

Useful for testing sync without XR hardware. Logged as `[XR_PRESENCE] TrackingBridge mode: Keyboard/XR`.

Keyboard fallback notes:

- the bridge restores the XR rig camera offset to headset-height while fallback is active
- body sync still derives from the head transform, so incorrect camera offset resolution will make the synced body appear too low
- server body contact proxies now run overlap checks as well as trigger callbacks to make keyboard pushing more reliable

---

## Spawn Lifecycle

1. Mirror spawns `XRRuntimeParticipantRoot` when a client connects (`autoCreatePlayer = 1`).
2. `RuntimeParticipant.OnStartServer()` registers with `RuntimeSessionManager`.
3. `XRParticipantRuntime.OnStartLocalPlayer()` configures local rig (proxies hidden).
4. `XRParticipantRuntime.OnStartClient()` (remote) configures remote rig (proxies shown).
5. `XRTrackingBridge.FindLocalRig()` finds the local player's `XRParticipantRuntime` and begins syncing.
6. `XRParticipantRuntime.OnStartServer()` creates left/right server hand contact proxies and one body capsule contact proxy for passive pushing.
7. In keyboard fallback mode, `XRTrackingBridge` still drives head/root sync so the same passive contact pipeline can be tested without a headset.

### Disconnect Cleanup

1. `RuntimeParticipant.OnStopServer()` → `sessionManager.HandleParticipantDisconnect(this)`.
2. `RuntimeSessionManager` unregisters participant and cleans up owned entities (`despawnOwnedEntitiesOnDisconnect = 1`).
3. Remote clients see the player's rig despawn via Mirror's normal NetworkIdentity cleanup.

---

## NetworkManager Prefab Registration

`XRNetworkManager.prefab` has:

- **playerPrefab** = `XRRuntimeParticipantRoot` (set in base prefab — Mirror auto-registers player prefabs).
- **autoCreatePlayer** = 1.
- **runtimeSpawnPrefabs** includes `NetworkInteractableCube` and `RuntimeEntity`.

The player prefab is registered through the `playerPrefab` field; it does not need to be duplicated in `spawnPrefabs`.

---

## Debug Logging

Files in this pipeline use these log prefixes:

| Prefix | File |
|--------|------|
| `[XR_PRESENCE]` | XRTrackingBridge (tracking mode, auto-wire result, rig found) |
| `[XR_BRIDGE]` | XRTrackingBridge (auto-wire warnings) |
| `[PARTICIPANT]` | RuntimeParticipant (init, session not found) |
| `[RUNTIME]` | RuntimeParticipant (start/stop local, removed) |

---

## Scenes

### XRPresenceTestScene

`Assets/Multiplayer/Scenes/XRPresenceTestScene.unity`

A combined XR presence validation scene containing:

- `XR Interaction Setup` (full XR Origin rig with locomotion)
- `XRNetworkManager` (with `configureSceneFlowOnAwake = 0` override — no auto scene transition)
- `XRTrackingBridge` (auto-wired to the XR Origin)
- `XRMultiplayerDebugGUI`
- Ground plane, directional light
- Cube with `XR Grab Interactable` for interaction testing (Nareen's scope)
- `XR Device Simulator UI` for in-editor XR input simulation

---

## Developer Rules

- Place one `XRTrackingBridge` in your scene alongside the XR Origin — it auto-wires.
- Do NOT place `XRRuntimeParticipant` or `XRParticipantRuntime` directly in the scene — they exist only on the networked prefab.
- Change `bodyHeightOffset` on `XRTrackingBridge` if your app uses a different eye-to-body offset.
- Use keyboard fallback (T) for sync testing without XR hardware.
- If the keyboard fallback body appears too low, inspect the XR rig camera offset naming first.
- Keep proxy spheres simple — they are not final avatars, just visual indicators.
- Root body sync drives the Capsule under `AvatarVisualRoot` — swap the Capsule for an app-specific body mesh.
- Register custom spawn prefabs in `XRNetworkManager.runtimeSpawnPrefabs`.
- Passive push contact lives in server-only proxies, not in the visual proxy spheres or avatar mesh.
- If using a different XR Origin variant, rename it to `"XR Origin (XR Rig)"` for auto-wire to work, or manually assign references in the Inspector.

---

## What Not to Touch

The XR presence pipeline does NOT touch:

- Shared interactable objects (Nareen's scope — `NetworkInteractable`, grab/ownership/release).
- Ownership transfer systems.
- MR calibration.
- Telemetry / structured logging.
- Deployment / headless server orchestration.
