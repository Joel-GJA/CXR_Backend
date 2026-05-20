using Mirror;
using UnityEngine;

public class RuntimeEntity : NetworkBehaviour
{
    [SyncVar]
    public uint ownerNetId;

    [SyncVar]
    public bool isInitialized;

    [SyncVar]
    private RuntimeEntityState currentState =
        RuntimeEntityState.Created;

    [Header("Optimization")]
    [Tooltip("Log lifecycle events (disable for short-lived objects like bullets)")]
    public bool logLifecycle = true;

    [Tooltip("Register in RuntimeEntityRegistry (disable when no lookups are needed)")]
    public bool trackInRegistry = true;

    public RuntimeEntityState CurrentState => currentState;

    public bool HasOwner => ownerNetId != 0;

    public uint OwnerNetId => ownerNetId;

    // =========================
    // INITIALIZATION
    // =========================

    [Server]
    public virtual void Initialize(uint ownerId)
    {
        if (isInitialized)
        {
            if (logLifecycle)
                Debug.LogWarning($"[ENTITY] Already Initialized | NetID={netId}");

            return;
        }

        ownerNetId = ownerId;

        isInitialized = true;

        if (logLifecycle)
            TransitionState(RuntimeEntityState.Initialized);

        if (logLifecycle)
            Debug.Log($"[ENTITY] Initialized | NetID={netId} | Owner={ownerNetId}");
    }

    // =========================
    // OWNERSHIP
    // =========================

    [Server]
    public virtual void Activate()
    {
        if (logLifecycle)
            TransitionState(RuntimeEntityState.Active);

        if (logLifecycle)
            Debug.Log($"[ENTITY] Activated | NetID={netId}");
    }

    [Server]
    public virtual void SetOwner(uint newOwnerNetId)
    {
        if (ownerNetId == newOwnerNetId)
            return;

        ownerNetId = newOwnerNetId;

        if (logLifecycle)
            Debug.Log($"[ENTITY] Ownership Changed | NetID={netId} | Owner={ownerNetId}");
    }

    [Server]
    public virtual void ClearOwner()
    {
        if (ownerNetId == 0)
            return;

        ownerNetId = 0;

        if (logLifecycle)
            Debug.Log($"[ENTITY] Ownership Cleared | NetID={netId}");
    }

    // =========================
    // CLEANUP
    // =========================

    [Server]
    public virtual void Cleanup()
    {
        if (CurrentState == RuntimeEntityState.CleaningUp ||
            CurrentState == RuntimeEntityState.Destroyed)
        {
            return;
        }

        ClearOwner();

        if (logLifecycle)
            TransitionState(RuntimeEntityState.CleaningUp);

        if (logLifecycle)
            Debug.Log($"[ENTITY] Cleanup | NetID={netId}");
    }

    // =========================
    // SERVER LIFECYCLE
    // =========================

    public override void OnStartServer()
    {
        base.OnStartServer();

        if (trackInRegistry)
            RuntimeEntityRegistry.Register(this);

        if (logLifecycle)
        {
            TransitionState(RuntimeEntityState.Registered);
            Debug.Log($"[ENTITY] Registered | NetID={netId}");
        }
    }

    public override void OnStopServer()
    {
        Cleanup();

        if (trackInRegistry)
            RuntimeEntityRegistry.Unregister(this);

        if (logLifecycle)
        {
            TransitionState(RuntimeEntityState.Destroyed);
            Debug.Log($"[ENTITY] Unregistered | NetID={netId}");
        }

        base.OnStopServer();
    }

    // =========================
    // STATE TRANSITIONS
    // =========================

    [Server]
    protected virtual void TransitionState(RuntimeEntityState newState)
    {
        currentState = newState;

        if (logLifecycle)
            Debug.Log($"[ENTITY] State Changed | NetID={netId} | State={currentState}");
    }
}
