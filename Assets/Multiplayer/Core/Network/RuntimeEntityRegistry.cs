using System.Collections.Generic;
using UnityEngine;

public static class RuntimeEntityRegistry
{
    private static readonly Dictionary<uint, RuntimeEntity> entities
        = new Dictionary<uint, RuntimeEntity>();

    public static void Register(RuntimeEntity entity)
    {
        if (!entities.ContainsKey(entity.netId))
        {
            entities.Add(entity.netId, entity);
        }

        Debug.Log($"[REGISTRY] Entity Registered | Count={entities.Count}");
    }

    public static void Unregister(RuntimeEntity entity)
    {
        if (entities.ContainsKey(entity.netId))
        {
            entities.Remove(entity.netId);
        }

        Debug.Log($"[REGISTRY] Entity Removed | Count={entities.Count}");
    }

    public static RuntimeEntity GetEntity(uint netId)
    {
        entities.TryGetValue(netId, out RuntimeEntity entity);

        return entity;
    }
}