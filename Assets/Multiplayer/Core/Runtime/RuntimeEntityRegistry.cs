using System.Collections.Generic;
using System.Linq;
using UnityEngine;

public static class RuntimeEntityRegistry
{
    private static readonly Dictionary<uint, RuntimeEntity>
        entities = new();

    // =========================
    // REGISTRATION
    // =========================

    public static void Register(RuntimeEntity entity)
    {
        if (entities.ContainsKey(entity.netId))
        {
            Debug.LogWarning(
                $"[REGISTRY] Duplicate Entity Registration | NetID={entity.netId}");

            return;
        }

        entities.Add(entity.netId, entity);

        Debug.Log(
            $"[REGISTRY] Entity Registered | Count={entities.Count}");
    }

    public static void Unregister(RuntimeEntity entity)
    {
        if (!entities.ContainsKey(entity.netId))
            return;

        entities.Remove(entity.netId);

        Debug.Log(
            $"[REGISTRY] Entity Removed | Count={entities.Count}");
    }

    // =========================
    // LOOKUP
    // =========================

    public static RuntimeEntity GetEntity(uint netId)
    {
        entities.TryGetValue(netId, out RuntimeEntity entity);

        return entity;
    }

    public static IReadOnlyCollection<RuntimeEntity> GetAllEntities()
    {
        return entities.Values;
    }

    // =========================
    // OWNERSHIP
    // =========================

    public static List<RuntimeEntity> GetOwnedEntities(uint ownerNetId)
    {
        return entities.Values
            .Where(entity => entity.ownerNetId == ownerNetId)
            .ToList();
    }
}