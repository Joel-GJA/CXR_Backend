using Mirror;
using UnityEngine;

public class RuntimeEntity : NetworkBehaviour
{
    [SyncVar]
    public uint ownerNetId;

    [SyncVar]
    public bool isInitialized;

    public virtual void Initialize(uint ownerId)
    {
        ownerNetId = ownerId;
        isInitialized = true;

        Debug.Log($"[ENTITY] Initialized | NetID={netId}");
    }

    public virtual void Cleanup()
    {
        Debug.Log($"[ENTITY] Cleanup | NetID={netId}");
    }

    public override void OnStartServer()
    {
        base.OnStartServer();

        RuntimeEntityRegistry.Register(this);

        Debug.Log($"[ENTITY] Registered | NetID={netId}");
    }

    public override void OnStopServer()
    {
        Cleanup();

        RuntimeEntityRegistry.Unregister(this);

        Debug.Log($"[ENTITY] Unregistered | NetID={netId}");

        base.OnStopServer();
    }
}