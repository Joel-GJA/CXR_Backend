# XR Setup Tooling Blueprint

## Purpose

Editor tooling for validating and auto-configuring XR presence in multiplayer scenes. Reduces manual setup when creating new scenes or debugging missing references.

Scripts:

- `Assets/Multiplayer/Core/Editor/XRTrackingBridgeEditor.cs`
- `Assets/Multiplayer/Core/Editor/XRPresenceValidator.cs`

---

## XRTrackingBridgeEditor

Custom Inspector for `XRTrackingBridge` that replaces the default Unity Inspector.

### Features

- **Help box** — shown when `xrOrigin`, `headSource`, or either hand source is null. Clearly labels what's missing.
- **Auto-Wire From Scene button** — calls `XRTrackingBridge.AutoWire()` to scan the scene and resolve all references. Supports Undo and marks the scene dirty.
- **Standard property fields** — all serialized fields remain editable when the auto-wire does not find the expected objects.

### Usage

1. Select the `XRTrackingBridge` GameObject in the scene.
2. If references are null, click **Auto-Wire From Scene**.
3. Verify the resolved references in the Inspector.

---

## XRPresenceValidator

Editor-only static class that validates scenes for XR presence requirements. Runs automatically on scene save and load.

### Menu Items

| Menu Path | Action |
|-----------|--------|
| `Tools/XR Presence/Validate Current Scene` | Run full validation and report issues |
| `Tools/XR Presence/Auto-Wire Tracking Bridge` | Find and wire the first `XRTrackingBridge` in the scene |

### Validation Checks

The validator checks:

| Check | Failure Message |
|-------|----------------|
| XR Origin exists | `"No XR Origin found"` |
| Head/Camera source present | `"No Camera found under XR Origin"` |
| Left/Right controller sources present | `"No Left Controller found"` / `"No Right Controller found"` |
| XRTrackingBridge exists | `"No XRTrackingBridge found"` |
| XRTrackingBridge has references wired | `"XRTrackingBridge references are not wired"` |
| XRNetworkManager.playerPrefab is set | `"No player prefab assigned"` |
| No XRRuntimeParticipant in scene | `"XRRuntimeParticipant should not be placed in the scene directly"` |

### Auto-Wire Behavior

The `Auto-Wire Tracking Bridge` menu item:

1. Finds the first `XRTrackingBridge` in the scene.
2. Calls `AutoWire()` to resolve XR Origin, camera, and controller references.
3. Does NOT create a new bridge if one already exists (re-wires existing).
4. Previously created new bridges unconditionally — changed in Phase 2 to preserve existing setup.

### Validation on Save/Load

The validator hooks into Unity's `SceneView.duringSceneGui` and `EditorApplication.playModeStateChanged` to run validation automatically. Warnings appear in the console during:

- Scene save
- Scene load
- Play mode entry

---

## Developer Rules

- Run `Tools/XR Presence/Validate Current Scene` after adding XR presence to a new scene.
- Run `Tools/XR Presence/Auto-Wire Tracking Bridge` after placing an `XRTrackingBridge` GameObject.
- The auto-wire is safe to re-run — it re-wires existing references without duplicating objects.
- Validation does not block builds; it only reports warnings.
