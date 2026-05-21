using Mirror;
using UnityEngine;

public class RuntimeSpawnTester : NetworkBehaviour
{
    private const string DefaultRuntimeEntityResourcePath =
        "SpawnableCarryObject";

    [Header("Runtime Spawn Testing")]
    [SerializeField]
    private GameObject runtimeEntityPrefab;

    [SerializeField]
    private Transform spawnPoint;

    private void Awake()
    {
        ResolveDefaultPrefab();
    }

    private void Update()
    {
        if (!isLocalPlayer)
            return;

        // Spawn test entity
        if (Input.GetKeyDown(KeyCode.F))
        {
            CmdSpawnTestEntity();
        }

        // Despawn owned entities (disabled — use RuntimeInteractableTester instead)
        // if (Input.GetKeyDown(KeyCode.G))
        // {
        //     CmdDespawnOwnedEntities();
        // }
    }

    // =========================
    // SPAWN
    // =========================

    [Command]
    private void CmdSpawnTestEntity()
    {
        ResolveDefaultPrefab();

        if (runtimeEntityPrefab == null)
        {
            Debug.LogError(
                "[SPAWN TEST] Missing Runtime Entity Prefab");

            return;
        }

        if (runtimeEntityPrefab.GetComponent<RuntimeEntity>() == null)
        {
            Debug.LogError(
                "[SPAWN TEST] Runtime Entity Prefab Missing RuntimeEntity");

            return;
        }

        Vector3 spawnPosition =
            spawnPoint != null
                ? spawnPoint.position
                : transform.position + transform.forward * 2f;

        RuntimeSpawnService.SpawnEntity<RuntimeEntity>(
            runtimeEntityPrefab,
            spawnPosition,
            Quaternion.identity,
            netId);
    }

    // =========================
    // DESPAWN
    // =========================

    [Command]
    private void CmdDespawnOwnedEntities()
    {
        var ownedEntities =
            RuntimeEntityRegistry.GetOwnedEntities(netId);

        foreach (RuntimeEntity entity in ownedEntities)
        {
            RuntimeSpawnService.DespawnEntity(entity);
        }
    }

    private void ResolveDefaultPrefab()
    {
        if (runtimeEntityPrefab != null)
        {
            return;
        }

        runtimeEntityPrefab =
            Resources.Load<GameObject>(DefaultRuntimeEntityResourcePath);
    }
}
