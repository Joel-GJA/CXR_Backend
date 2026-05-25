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

    [Header("Physics Control")]
    [SerializeField]
    private bool disableGravityOnGrab = true;

    [SerializeField]
    private bool setKinematicOnGrab = false;

    private Rigidbody rb;

    public bool UseFollowOffset { get; set; } = true;

    public InteractableState CurrentInteractableState => interactableState;
    public uint HoldingPlayerNetId => holdingPlayerNetId;
    public bool IsGrabbed => interactableState == InteractableState.Grabbed;

    public event System.Action<InteractableState, InteractableState> InteractableStateChanged;

    private void Awake()
    {
        rb = GetComponent<Rigidbody>();
    }

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
            UpdateGrabbedBehavior();
        }
    }

    protected virtual void UpdateGrabbedBehavior()
    {
        if (!UseFollowOffset)
            return;
        FollowHolder();
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
            $"HolderNetID={holdingPlayerNetId}" +
            $" | isServer={isServer} | isClient={isClient}");
    }

    [Command(requiresAuthority = true)]
    public void CmdRequestRelease()
    {
        if (interactableState != InteractableState.Grabbed)
        {
            Debug.LogWarning(
                $"[INTERACTION] Release rejected | " +
                $"state={interactableState} | " +
                $"NetID={netId}");
            return;
        }

        uint releasedBy = holdingPlayerNetId;

        interactableState = InteractableState.Releasing;

        netIdentity.RemoveClientAuthority();

        holdingPlayerNetId = 0;
        interactableState = InteractableState.Idle;

        Debug.Log(
            $"[OWNERSHIP] Authority Released | " +
            $"InteractableNetID={netId} | " +
            $"ReleasedBy={releasedBy}");
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
            $"isGravity={rb != null && rb.useGravity} | " +
            $"isKinematic={rb != null && rb.isKinematic} | " +
            $"{oldState} -> {newState}");

        if (rb == null)
            return;

        if (newState == InteractableState.Grabbed)
        {
            bool wasGravity = rb.useGravity;
            bool wasKinematic = rb.isKinematic;
            if (disableGravityOnGrab)
                rb.useGravity = false;
            if (setKinematicOnGrab)
                rb.isKinematic = true;
            rb.velocity = Vector3.zero;
            rb.angularVelocity = Vector3.zero;
            Debug.Log(
                $"[INTERACTION] Physics Applied G | " +
                $"NetID={netId} | " +
                $"gravity={wasGravity}->{rb.useGravity} | " +
                $"kinematic={wasKinematic}->{rb.isKinematic}");
        }
        else if (newState == InteractableState.Idle)
        {
            bool wasGravity = rb.useGravity;
            bool wasKinematic = rb.isKinematic;
            if (disableGravityOnGrab)
                rb.useGravity = true;
            if (setKinematicOnGrab)
                rb.isKinematic = false;
            Debug.Log(
                $"[INTERACTION] Physics Applied I | " +
                $"NetID={netId} | " +
                $"gravity={wasGravity}->{rb.useGravity} | " +
                $"kinematic={wasKinematic}->{rb.isKinematic}");
        }
    }

    private void OnHoldingPlayerChanged(uint oldValue, uint newValue)
    {
        Debug.Log(
            $"[OWNERSHIP] Holding Player Changed | " +
            $"NetID={netId} | " +
            $"{oldValue} -> {newValue}");
    }
}
