using Mirror;
using UnityEngine;

public static class RuntimeSpawnService
{
    // =========================
    // ENTITY SPAWN
    // =========================

    [Server]
    public static T SpawnEntity<T>(
        GameObject prefab,
        Vector3 position,
        Quaternion rotation,
        uint ownerNetId = 0)
        where T : RuntimeEntity
    {
        // -------------------------
        // VALIDATION
        // -------------------------

        if (prefab == null)
        {
            Debug.LogError(
                "[SPAWN SERVICE] Null Prefab");

            return null;
        }

        // -------------------------
        // INSTANTIATE
        // -------------------------

        GameObject instance =
            Object.Instantiate(
                prefab,
                position,
                rotation);

        // -------------------------
        // ENTITY LOOKUP
        // -------------------------

        T entity = instance.GetComponent<T>();

        if (entity == null)
        {
            Debug.LogError(
                "[SPAWN SERVICE] Spawned Object Missing RuntimeEntity");

            Object.Destroy(instance);

            return null;
        }

        // -------------------------
        // NETWORK SPAWN
        // -------------------------

        NetworkServer.Spawn(instance);

        // -------------------------
        // INITIALIZATION
        // -------------------------

        entity.Initialize(ownerNetId);

        entity.SetOwner(ownerNetId);

        // -------------------------
        // STATE TRANSITION
        // -------------------------

        entity.Activate();

        Debug.Log(
            $"[SPAWN SERVICE] Entity Spawned | " +
            $"NetID={entity.netId} | " +
            $"Owner={ownerNetId}");

        return entity;
    }

    [Server]
    public static void DespawnEntity(RuntimeEntity entity)
    {
        if (entity == null)
        {
            Debug.LogWarning(
                "[SPAWN SERVICE] Null Entity Despawn");

            return;
        }

        entity.Cleanup();

        NetworkServer.Destroy(entity.gameObject);

        Debug.Log(
            $"[SPAWN SERVICE] Entity Despawned | " +
            $"NetID={entity.netId}");
    }
}