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
            Debug.LogWarning(
                $"[ENTITY] Already Initialized | NetID={netId}");

            return;
        }

        ownerNetId = ownerId;

        isInitialized = true;

        TransitionState(RuntimeEntityState.Initialized);

        Debug.Log(
            $"[ENTITY] Initialized | " +
            $"NetID={netId} | " +
            $"Owner={ownerNetId}");
    }

    // =========================
    // OWNERSHIP
    // =========================

    [Server]
    public virtual void Activate()
    {
        TransitionState(RuntimeEntityState.Active);

        Debug.Log(
            $"[ENTITY] Activated | NetID={netId}");
    }

    [Server]
    public virtual void SetOwner(uint newOwnerNetId)
    {
        if (ownerNetId == newOwnerNetId)
        {
            return;
        }

        ownerNetId = newOwnerNetId;

        Debug.Log(
            $"[ENTITY] Ownership Changed | " +
            $"NetID={netId} | " +
            $"Owner={ownerNetId}");
    }

    [Server]
    public virtual void ClearOwner()
    {
        if (ownerNetId == 0)
        {
            return;
        }

        ownerNetId = 0;

        Debug.Log(
            $"[ENTITY] Ownership Cleared | " +
            $"NetID={netId}");
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

        TransitionState(RuntimeEntityState.CleaningUp);

        Debug.Log(
            $"[ENTITY] Cleanup | NetID={netId}");
    }

    // =========================
    // SERVER LIFECYCLE
    // =========================

    public override void OnStartServer()
    {
        base.OnStartServer();

        RuntimeEntityRegistry.Register(this);

        TransitionState(RuntimeEntityState.Registered);

        Debug.Log($"[ENTITY] Registered | NetID={netId}");
    }

    public override void OnStopServer()
    {
        Cleanup();

        RuntimeEntityRegistry.Unregister(this);

        TransitionState(RuntimeEntityState.Destroyed);

        Debug.Log($"[ENTITY] Unregistered | NetID={netId}");

        base.OnStopServer();
    }

    // =========================
    // STATE TRANSITIONS
    // =========================

    [Server]
    protected virtual void TransitionState(
        RuntimeEntityState newState)
    {
        currentState = newState;

        Debug.Log(
            $"[ENTITY] State Changed | " +
            $"NetID={netId} | " +
            $"State={currentState}");
    }
}
