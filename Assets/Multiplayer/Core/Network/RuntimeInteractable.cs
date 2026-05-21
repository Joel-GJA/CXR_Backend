using Mirror;
using UnityEngine;

public class RuntimeInteractable : RuntimeEntity
{
    [Header("Interaction State")]
    [SyncVar(hook = nameof(OnInteractableStateChanged))]
    private InteractableState interactableState = InteractableState.Idle;

    [SyncVar(hook = nameof(OnHoldingPlayerChanged))]
    private uint holdingPlayerNetId;

    [Header("Follow")]
    [SerializeField]
    private float followSpeed = 15f;

    [SerializeField]
    private Vector3 holdOffset = new Vector3(0f, 1.2f, 2f);

    public InteractableState CurrentInteractableState => interactableState;
    public uint HoldingPlayerNetId => holdingPlayerNetId;
    public bool IsGrabbed => interactableState == InteractableState.Grabbed;

    public event System.Action<InteractableState, InteractableState> InteractableStateChanged;

    private void Update()
    {
        if (!isClient)
            return;

        if (Input.GetKeyDown(KeyCode.P))
        {
            LocalTryGrab();
        }

        if (Input.GetKeyDown(KeyCode.R) && IsGrabbed && isOwned)
        {
            LocalTryRelease();
        }

        if (IsGrabbed && isOwned)
        {
            FollowHolder();
        }
    }

    private void FollowHolder()
    {
        if (!NetworkClient.spawned.TryGetValue(holdingPlayerNetId, out NetworkIdentity holderIdentity))
            return;

        Transform holder = holderIdentity.transform;
        Vector3 target = holder.position + holder.TransformDirection(holdOffset);
        transform.position = Vector3.Lerp(transform.position, target, followSpeed * Time.deltaTime);
    }

    public void LocalTryGrab()
    {
        if (!isClient || IsGrabbed)
            return;

        CmdRequestGrab();
    }

    public void LocalTryRelease()
    {
        if (!isClient || !IsGrabbed || !isOwned)
            return;

        CmdRequestRelease();
    }

    public override void OnStartServer()
    {
        base.OnStartServer();
        interactableState = InteractableState.Idle;
        holdingPlayerNetId = 0;
    }

    [Command(requiresAuthority = false)]
    public void CmdRequestGrab(NetworkConnectionToClient sender = null)
    {
        if (sender == null)
        {
            Debug.LogWarning("[INTERACTION] Grab rejected - null sender");
            return;
        }

        if (interactableState == InteractableState.Grabbed)
        {
            Debug.LogWarning("[INTERACTION] Grab rejected - already held");
            return;
        }

        uint requestingPlayerNetId = sender.identity.netId;

        netIdentity.AssignClientAuthority(sender);

        holdingPlayerNetId = requestingPlayerNetId;
        interactableState = InteractableState.Grabbed;

        Debug.Log(
            $"[OWNERSHIP] Authority Assigned | " +
            $"InteractableNetID={netId} | " +
            $"HolderNetID={holdingPlayerNetId}");
    }

    [Command(requiresAuthority = true)]
    public void CmdRequestRelease()
    {
        if (interactableState != InteractableState.Grabbed)
            return;

        interactableState = InteractableState.Releasing;

        netIdentity.RemoveClientAuthority();

        holdingPlayerNetId = 0;
        interactableState = InteractableState.Idle;

        Debug.Log(
            $"[OWNERSHIP] Authority Released | " +
            $"InteractableNetID={netId}");
    }

    [Server]
    public void ServerForceRelease()
    {
        if (interactableState != InteractableState.Grabbed)
            return;

        interactableState = InteractableState.Releasing;

        netIdentity.RemoveClientAuthority();

        holdingPlayerNetId = 0;
        interactableState = InteractableState.Idle;

        Debug.Log(
            $"[OWNERSHIP] Force Released | " +
            $"InteractableNetID={netId}");
    }

    public override void OnStartAuthority()
    {
        base.OnStartAuthority();
        Debug.Log(
            $"[INTERACTION] Local Authority Gained | " +
            $"NetID={netId}");
    }

    public override void OnStopAuthority()
    {
        base.OnStopAuthority();
        Debug.Log(
            $"[INTERACTION] Local Authority Lost | " +
            $"NetID={netId}");
    }

    public override void OnStopClient()
    {
        if (isServer && IsGrabbed)
        {
            ServerForceRelease();
        }
        base.OnStopClient();
    }

    private void OnInteractableStateChanged(
        InteractableState oldState,
        InteractableState newState)
    {
        InteractableStateChanged?.Invoke(oldState, newState);

        Debug.Log(
            $"[INTERACTION] State Changed | " +
            $"NetID={netId} | " +
            $"{oldState} -> {newState}");
    }

    private void OnHoldingPlayerChanged(uint oldValue, uint newValue)
    {
        Debug.Log(
            $"[OWNERSHIP] Holding Player Changed | " +
            $"NetID={netId} | " +
            $"{oldValue} -> {newValue}");
    }
}
