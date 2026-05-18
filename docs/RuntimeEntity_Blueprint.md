# Runtime Entity Blueprint

## Purpose

`RuntimeEntity` is the baseline for networked objects that participate in the multiplayer runtime lifecycle. It gives app teams a repeatable way to build objects that have ownership, initialization, activation, cleanup, and registry visibility.

Prefab paths:

- `Assets/Multiplayer/Prefab/RuntimeEntity.prefab`
- `Assets/Multiplayer/Prefab/NetworkInteractableCube.prefab`

Scripts:

- `Assets/Multiplayer/Core/Runtime/RuntimeEntity.cs`
- `Assets/Multiplayer/Core/Runtime/RuntimeEntityRegistry.cs`
- `Assets/Multiplayer/Core/Runtime/RuntimeSpawnService.cs`
- `Assets/Multiplayer/Core/Network/NetworkInteractable.cs`

## Required Components

A runtime entity prefab should include:

- `NetworkIdentity`
- `RuntimeEntity` or a subclass
- optional `NetworkTransformReliable`
- optional collider/rigidbody/renderer

If the object is spawned over the network, register the prefab with `XRNetworkManager.runtimeSpawnPrefabs`.

## Entity State

`RuntimeEntityState` describes the lifecycle:

- `Created`
- `Registered`
- `Initialized`
- `Active`
- `CleaningUp`
- `Destroyed`

## Ownership

Ownership is tracked by `ownerNetId`.

Use server-side methods:

- `Initialize(uint ownerId)`
- `SetOwner(uint newOwnerNetId)`
- `ClearOwner()`
- `Activate()`
- `Cleanup()`

Do not assign owner fields directly from app code.

## Spawn Pattern

Use `RuntimeSpawnService` from server-side code:

```csharp
[Server]
public RuntimeEntity SpawnTrainingObject(
    GameObject prefab,
    Vector3 position,
    Quaternion rotation,
    uint participantNetId)
{
    return RuntimeSpawnService.SpawnEntity<RuntimeEntity>(
        prefab,
        position,
        rotation,
        participantNetId);
}
```

The spawn service:

1. Instantiates the prefab.
2. Checks that it has the requested `RuntimeEntity` type.
3. Calls `NetworkServer.Spawn`.
4. Initializes owner state.
5. Activates the entity.

## Cleanup Pattern

Use:

```csharp
[Server]
public void RemoveObject(RuntimeEntity entity)
{
    RuntimeSpawnService.DespawnEntity(entity);
}
```

The despawn service calls `Cleanup` and then destroys the object through Mirror.

## Registry

`RuntimeEntityRegistry` tracks entities on the server.

Useful lookups:

- `GetEntity(uint netId)`
- `GetAllEntities()`
- `GetOwnedEntities(uint ownerNetId)`

The session manager uses this registry to clean up participant-owned entities on disconnect.

## NetworkInteractable

`NetworkInteractable` currently derives from `RuntimeEntity`. It exists as a named app-facing example for interactable objects that need the runtime lifecycle. App teams can either:

- subclass `RuntimeEntity` directly, or
- subclass/compose `NetworkInteractable` for interaction-specific behavior.

## Developer Rules

- Spawn runtime entities on the server.
- Register spawnable prefabs with the network manager.
- Use `ownerNetId` for participant ownership.
- Keep cleanup server-authoritative.
- Avoid gameplay logic that depends on local-only object creation.

