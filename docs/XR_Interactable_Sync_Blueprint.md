# XR Interactable Sync Blueprint

## Purpose

This document explains the current networked XR interactable implementation, the grab/release physics changes, and how to set up future interactable objects such as cubes, balls, tools, guns, or irregular props.

Key files:

- `Assets/Multiplayer/Core/Network/RuntimeInteractable.cs`
- `Assets/Multiplayer/XR/XRInteractableBridge.cs`
- `Assets/Multiplayer/Prefab/NetworkInteractableCube.prefab`
- `Assets/Multiplayer/Scenes/XRPresenceTestScene.unity`

## Current Interaction Flow

1. `XRGrabInteractable` detects grab/release through XR Interaction Toolkit.
2. `XRInteractableBridge` forwards grab/release intent to `RuntimeInteractable`.
3. `RuntimeInteractable.CmdRequestGrab` asks the server for temporary client authority.
4. While grabbed, the grabbing client drives the object transform through Mirror `NetworkTransformReliable`.
5. On release, the client sends final position, final rotation, linear velocity, and angular velocity.
6. The server validates the release pose, restores server physics, applies velocity, and broadcasts the accepted pose.
7. Non-owning clients keep the Rigidbody kinematic and render server-synchronized transforms.

This keeps grabbing responsive while making released-object physics server-authoritative.

## Implemented Changes

### Release Pose Validation

Release now sends position, rotation, velocity, and angular velocity. The server validates the release position before simulating physics and clamps the accepted release distance from the holder. This protects against stale client poses and XR-origin mismatch.

### Server Physics Handoff

On release, the server:

1. Applies the validated pose.
2. Clears old velocity.
3. Removes client authority.
4. Restores server Rigidbody gravity/kinematic state.
5. Applies clamped release velocity and angular velocity.
6. Teleports clients to the accepted server pose.

### XRIT Throw Conflict Removed

`Throw On Detach` is disabled on the networked interactable cube prefab and the XR presence test scene instances.

The network bridge captures release velocity and replays it on the server, so XR Interaction Toolkit should not also try to throw the local Rigidbody.

### Conservative Post-Release Stabilization

For a short period after release, the server performs a conservative correction pass:

- only runs while the object is moving slowly
- ignores tiny penetration noise
- caps correction per physics step
- ignores dynamic Rigidbody supports during ongoing stabilization
- keeps a small ground snap for static/kinematic surfaces only

This preserves clean ground landings without fighting cube-on-cube stacking.

### Compound Collider Support

The stabilizer no longer assumes one cube-shaped root collider. It gathers all non-trigger child colliders and checks penetration using each collider's proposed world pose.

This supports:

- boxes
- spheres
- capsules
- tools
- guns
- irregular props built from compound colliders
- convex mesh-collider objects

Collider caches refresh if child colliders are added or removed at runtime. Parent/environment colliders are not treated as part of the interactable.

## Recommended Prefab Setup

Every networked XR interactable prefab should include:

- `NetworkIdentity`
- `RuntimeInteractable` or subclass
- `NetworkTransformReliable`
- `Rigidbody`
- one or more non-trigger colliders
- `XRGrabInteractable`
- `XRInteractableBridge`

Recommended Rigidbody settings:

- `Use Gravity`: enabled by default
- `Is Kinematic`: disabled by default
- `Interpolate`: Interpolate
- `Collision Detection`: Continuous Dynamic for thrown objects
- Mass: set based on object scale and expected feel

`RuntimeInteractable` also applies safe runtime defaults: if a prefab still uses `RigidbodyInterpolation.None`, it changes it to `Interpolate`; if it still uses `CollisionDetectionMode.Discrete`, it changes it to `ContinuousDynamic`. Explicitly stronger settings are left alone.

Recommended XR Grab Interactable settings:

- `Movement Type`: Instantaneous is acceptable for the current authority-transfer model
- `Track Position`: enabled
- `Track Rotation`: enabled
- `Throw On Detach`: disabled

## Collider Guidance By Shape

### Cubes and Boxes

Use a `BoxCollider` that matches the visible object. Avoid oversized colliders, because the server treats the collider as the real physical volume.

### Spheres and Round Objects

Use a `SphereCollider` whenever possible. Keep Continuous Dynamic collision enabled for thrown round objects.

### Capsules and Long Rounded Objects

Use a `CapsuleCollider` for rods, bottles, handles, and baton-like tools. Make sure the capsule direction matches the model's long axis.

### Guns, Tools, and Irregular Props

Prefer compound primitive colliders:

- one box for the main body
- one box/capsule for the handle
- one box/capsule for the barrel
- optional small colliders for major protrusions

This is usually more stable than one detailed mesh collider.

### Complex Mesh Props

Use a simplified physics shape, not the render mesh.

Best options:

- compound `BoxCollider` / `CapsuleCollider` / `SphereCollider`
- convex `MeshCollider` for simple solid shapes

Avoid non-convex `MeshCollider` on dynamic Rigidbody interactables.

## RuntimeInteractable Inspector Fields

`disableGravityOnGrab`

Disables gravity while held. Keep enabled for normal grab behavior.

`setKinematicOnGrab`

Sets the Rigidbody kinematic while held. Keep enabled when XRIT drives the object directly.

`maxReleaseDistanceFromHolder`

Maximum accepted release distance from the networked holder.

`releaseDepenetrationPadding`

Small extra offset applied when the server resolves penetration. Keep small, usually `0.01` to `0.03`.

`releaseDepenetrationIterations`

Number of server correction iterations. `4` is a good default. Increase only for complicated compound collider objects.

`maxReleaseVelocity`

Caps throw speed. Raise for fast objects, lower for heavy props.

`maxReleaseAngularVelocity`

Caps spin speed. Raise for objects designed to spin, lower for props that should settle calmly.

## Future Object Checklist

When creating a new networked interactable:

1. Add the required network, XR, Rigidbody, and collider components.
2. Disable XRIT `Throw On Detach`.
3. Use Continuous Dynamic collision for thrown objects.
4. Use primitive or convex colliders that match the intended physical shape.
5. Register the prefab in `XRNetworkManager.runtimeSpawnPrefabs` if it is spawned dynamically.
6. Test host and client release from different heights.
7. Test stacking on static surfaces and on another dynamic object.
8. Tune release velocity caps only if the object feels too weak or too explosive.

## Debugging Tips

If an object falls through the ground:

- confirm Collision Detection is Continuous Dynamic
- check that colliders are not triggers
- check that the ground has a collider
- reduce `maxReleaseVelocity`

If an object hovers:

- check collider size and center
- ensure visual mesh and collider are aligned
- verify the ground collider is not offset from the visible ground

If an object jitters while stacking:

- avoid overly complex mesh colliders
- use compound primitive colliders
- check mass differences between stacked objects
- reduce angular velocity cap
- avoid custom snapping to dynamic Rigidbody supports

If grabbing feels delayed:

- verify the object receives client authority on grab
- verify `NetworkTransformReliable` is `ClientToServer`
- keep `syncInterval` low enough for held-object responsiveness
