using Mirror;
using UnityEngine;

[DefaultExecutionOrder(100)]
public class RuntimeInteractable : RuntimeEntity
{
    [Header("Interaction State")]
    [SyncVar(hook = nameof(OnInteractableStateChanged))]
    private InteractableState interactableState = InteractableState.Idle;

    [SyncVar(hook = nameof(OnHoldingPlayerChanged))]
    private uint holdingPlayerNetId;

    [Header("Physics Control")]
    [SerializeField]
    private bool disableGravityOnGrab = true;

    [SerializeField]
    private bool setKinematicOnGrab = false;

    [Header("Release Validation")]
    [SerializeField]
    private float maxReleaseDistanceFromHolder = 4f;

    [SerializeField]
    private float releaseDepenetrationPadding = 0.02f;

    [SerializeField]
    private int releaseDepenetrationIterations = 4;

    [SerializeField]
    private float maxReleaseVelocity = 12f;

    [SerializeField]
    private float maxReleaseAngularVelocity = 25f;

    private Rigidbody rb;
    private Collider objectCollider;

    public InteractableState CurrentInteractableState => interactableState;
    public uint HoldingPlayerNetId => holdingPlayerNetId;
    public bool IsGrabbed => interactableState == InteractableState.Grabbed;

    public event System.Action<InteractableState, InteractableState> InteractableStateChanged;

    private void Awake()
    {
        rb = GetComponent<Rigidbody>();
        objectCollider = GetComponent<Collider>();
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
            LocalTryRelease(transform.position, Vector3.zero, Vector3.zero);
        }
    }

    public void LocalTryGrab()
    {
        if (!isClient || IsGrabbed)
            return;

        CmdRequestGrab();
    }

    public void LocalTryRelease()
    {
        LocalTryRelease(
            transform.position,
            transform.rotation,
            Vector3.zero,
            Vector3.zero);
    }

    public void LocalTryRelease(Vector3 releasePosition, Vector3 velocity, Vector3 angularVelocity)
    {
        LocalTryRelease(releasePosition, transform.rotation, velocity, angularVelocity);
    }

    public void LocalTryRelease(
        Vector3 releasePosition,
        Quaternion releaseRotation,
        Vector3 velocity,
        Vector3 angularVelocity)
    {
        if (!isClient || !IsGrabbed || !isOwned)
            return;

        CmdRequestRelease(
            releasePosition,
            releaseRotation,
            velocity,
            angularVelocity);
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
    public void CmdRequestRelease(
        Vector3 finalPosition,
        Quaternion finalRotation,
        Vector3 velocity,
        Vector3 angularVelocity)
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
        Vector3 validatedPosition = ValidateReleasePosition(
            finalPosition,
            finalRotation,
            releasedBy);
        Vector3 clampedVelocity = Vector3.ClampMagnitude(
            velocity,
            maxReleaseVelocity);
        Vector3 clampedAngularVelocity = Vector3.ClampMagnitude(
            angularVelocity,
            maxReleaseAngularVelocity);

        if (rb != null)
        {
            rb.position = validatedPosition;
            rb.rotation = finalRotation;
            rb.velocity = Vector3.zero;
            rb.angularVelocity = Vector3.zero;
        }
        else
        {
            transform.SetPositionAndRotation(validatedPosition, finalRotation);
        }
        Physics.SyncTransforms();

        interactableState = InteractableState.Releasing;

        netIdentity.RemoveClientAuthority();

        holdingPlayerNetId = 0;
        interactableState = InteractableState.Idle;

        ApplyServerReleasedPhysics(clampedVelocity, clampedAngularVelocity);

        // Teleport ALL clients to the server-verified release position via NTR.
        if (TryGetComponent(out NetworkTransformReliable ntr))
        {
            ntr.RpcTeleport(
                rb != null ? rb.position : transform.position,
                rb != null ? rb.rotation : transform.rotation);
            ntr.SetDirty();
        }

        Debug.Log(
            $"[OWNERSHIP] Authority Released | " +
            $"InteractableNetID={netId} | " +
            $"ReleasedBy={releasedBy} | " +
            $"finalPos={finalPosition} | " +
            $"validatedPos={validatedPosition} | " +
            $"vel={clampedVelocity} | " +
            $"angVel={clampedAngularVelocity}");
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

            ApplyGrabPhysics();

            Debug.Log(
                $"[INTERACTION] Physics Applied G | " +
                $"NetID={netId} | " +
                $"gravity={wasGravity}->{rb.useGravity} | " +
                $"kinematic={wasKinematic}->{rb.isKinematic}");
        }
        else if (newState == InteractableState.Idle)
        {
            if (isServer)
            {
                ApplyServerIdlePhysics();
            }
            else
            {
                ApplyRemoteIdlePhysics();
            }

            Debug.Log(
                $"[INTERACTION] Physics Applied I | " +
                $"NetID={netId} | " +
                $"gravity={rb.useGravity} | " +
                $"kinematic={rb.isKinematic} | " +
                $"isServer={isServer}");
        }
    }

    private void OnHoldingPlayerChanged(uint oldValue, uint newValue)
    {
        Debug.Log(
            $"[OWNERSHIP] Holding Player Changed | " +
            $"NetID={netId} | " +
            $"{oldValue} -> {newValue}");
    }

    private void ApplyGrabPhysics()
    {
        if (rb == null)
            return;

        if (disableGravityOnGrab)
            rb.useGravity = false;
        if (setKinematicOnGrab)
            rb.isKinematic = true;

        rb.velocity = Vector3.zero;
        rb.angularVelocity = Vector3.zero;
    }

    private void ApplyServerIdlePhysics()
    {
        if (rb == null)
            return;

        if (setKinematicOnGrab)
            rb.isKinematic = false;
        if (disableGravityOnGrab)
            rb.useGravity = true;
    }

    private void ApplyServerReleasedPhysics(
        Vector3 velocity,
        Vector3 angularVelocity)
    {
        if (rb == null)
            return;

        ApplyServerIdlePhysics();
        rb.WakeUp();
        rb.velocity = velocity;
        rb.angularVelocity = angularVelocity;
    }

    private void ApplyRemoteIdlePhysics()
    {
        if (rb == null)
            return;

        rb.useGravity = false;
        rb.isKinematic = true;
        rb.velocity = Vector3.zero;
        rb.angularVelocity = Vector3.zero;
    }

    [Server]
    private Vector3 ValidateReleasePosition(
        Vector3 requestedPosition,
        Quaternion requestedRotation,
        uint releasedBy)
    {
        Vector3 position = ClampReleaseDistanceFromHolder(
            requestedPosition,
            releasedBy);

        if (objectCollider == null)
            return position;

        Bounds bounds = objectCollider.bounds;
        Vector3 localOffset = transform.InverseTransformPoint(bounds.center);
        Vector3 halfExtents = bounds.extents + Vector3.one * releaseDepenetrationPadding;

        for (int index = 0; index < releaseDepenetrationIterations; index++)
        {
            Vector3 center = position + requestedRotation * localOffset;
            Collider[] overlaps = Physics.OverlapBox(
                center,
                halfExtents,
                requestedRotation,
                Physics.AllLayers,
                QueryTriggerInteraction.Ignore);

            bool resolvedAnyOverlap = false;

            foreach (Collider overlap in overlaps)
            {
                if (overlap == null ||
                    overlap == objectCollider ||
                    overlap.transform.IsChildOf(transform) ||
                    transform.IsChildOf(overlap.transform))
                {
                    continue;
                }

                if (Physics.ComputePenetration(
                    objectCollider,
                    position,
                    requestedRotation,
                    overlap,
                    overlap.transform.position,
                    overlap.transform.rotation,
                    out Vector3 direction,
                    out float distance))
                {
                    position += direction * (distance + releaseDepenetrationPadding);
                    resolvedAnyOverlap = true;
                }
            }

            if (!resolvedAnyOverlap)
                break;
        }

        return position;
    }

    [Server]
    private Vector3 ClampReleaseDistanceFromHolder(
        Vector3 requestedPosition,
        uint releasedBy)
    {
        if (maxReleaseDistanceFromHolder <= 0f ||
            releasedBy == 0 ||
            !NetworkServer.spawned.TryGetValue(
                releasedBy,
                out NetworkIdentity holderIdentity))
        {
            return requestedPosition;
        }

        Vector3 holderPosition = holderIdentity.transform.position;
        Vector3 holderToRelease = requestedPosition - holderPosition;

        if (holderToRelease.magnitude <= maxReleaseDistanceFromHolder)
            return requestedPosition;

        return holderPosition +
            holderToRelease.normalized * maxReleaseDistanceFromHolder;
    }
}
