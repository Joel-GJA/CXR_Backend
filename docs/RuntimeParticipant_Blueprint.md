# Runtime Participant Blueprint

## Purpose

`RuntimeParticipant` is the standard base for a connected player or session participant. It extends `RuntimeEntity`, so participants follow the same network lifecycle and ownership model as other runtime entities.

Prefab path:

`Assets/Multiplayer/Prefab/XRRuntimeParticipantRoot.prefab`

Scripts:

- `Assets/Multiplayer/Core/Runtime/RuntimeParticipant.cs`
- `Assets/Multiplayer/Core/Runtime/RuntimeParticipantInstaller.cs`

## Required Components

The participant prefab should include:

- `NetworkIdentity`
- `NetworkTransformReliable`
- `RuntimeParticipant`
- `RuntimeParticipantInstaller`

The current sample participant includes XR presence components (`XRParticipantRuntime`, optional `XRTrackingBridge` integration) and basic body visualization (Capsule under `AvatarVisualRoot`). App teams can extend or replace the body visual while keeping the XR sync infrastructure.

## Required Components

The participant prefab should include:

- `NetworkIdentity`
- `NetworkTransformReliable`
- `RuntimeParticipant`
- `RuntimeParticipantInstaller`

For XR presence, the prefab adds:

- `XRParticipantRuntime` — local/remote rig separation and proxy visibility.
- `XRRuntimeParticipant` — resolves HeadRoot/LeftHandRoot/RightHandRoot anchors inherited from `RuntimeParticipant`.

## Standard Anchors

The prefab reserves these child anchors:

- `HeadRoot`
- `LeftHandRoot`
- `RightHandRoot`
- `RigMount`
- `AvatarVisualRoot`

Use these anchors for app-specific XR content:

- Head or HMD visual tracking under `HeadRoot`.
- Controller or hand visuals under `LeftHandRoot` and `RightHandRoot`.
- Local XR rig mounting under `RigMount`.
- Avatar visuals under `AvatarVisualRoot`.

The prefab includes proxy spheres under each anchor (HeadProxy, LeftHandProxy, RightHandProxy). These are disabled for the local player and enabled for remote players by `XRParticipantRuntime`.

## Root Body Sync

The root `NetworkTransformReliable` on the prefab syncs body position. `XRTrackingBridge` drives it each frame:

```
root.position = headSource.position + Vector3.down * bodyHeightOffset
root.rotation  = Quaternion.Euler(0f, headSource.eulerAngles.y, 0f)
```

`bodyHeightOffset` defaults to 1.6 and is configurable on `XRTrackingBridge`. The Capsule under `AvatarVisualRoot` follows the root position to provide basic body visualization for remote players.

## Local vs Remote Behavior

`XRParticipantRuntime` separates local and remote rig behavior:

| Event | Local Player | Remote Player |
|-------|-------------|---------------|
| `OnStartLocalPlayer()` | Hides head/hand proxy spheres | — |
| `OnStartClient()` (not local) | — | Shows head/hand proxy spheres |
| `OnStopClient()` | Logs cleanup | Logs cleanup |

## Server Registration Flow

1. Mirror spawns the participant prefab.
2. `RuntimeParticipant.OnStartServer` finds `RuntimeSessionManager`.
3. `RuntimeSessionManager.RegisterParticipant` initializes and activates the participant.
4. Participant info is recorded by netId and connection ID.
5. Runtime metadata is republished to room discovery.

## Disconnect Flow

1. Mirror stops the server-side participant.
2. `RuntimeParticipant.OnStopServer` asks the session manager to handle disconnect.
3. The session manager unregisters the participant.
4. Owned entities are cleaned up according to session manager settings.

## Customization Rules

Good customizations:

- Add app-specific avatar scripts.
- Add XR input rig binding.
- Add hand/head sync scripts in later phases.
- Add interaction scripts that call server-authoritative entity methods.
- Replace visual children under `AvatarVisualRoot`.

Avoid:

- Removing `NetworkIdentity`.
- Removing `RuntimeParticipant`.
- Removing `RuntimeParticipantInstaller` without replacing its configuration behavior.
- Registering participants manually from app UI.
- Bypassing `RuntimeSessionManager` for disconnect cleanup.

## Subclass Example

```csharp
public sealed class TrainingParticipant : RuntimeParticipant
{
    public string Role { get; private set; }

    public void AssignRole(string role)
    {
        Role = string.IsNullOrWhiteSpace(role) ? "Observer" : role;
    }
}
```

