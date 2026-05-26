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
    private float maxReleaseDistanceFromCurrentPose = 1.25f;

    [SerializeField]
    private float releaseDepenetrationPadding = 0.02f;

    [SerializeField]
    private int releaseDepenetrationIterations = 4;

    [SerializeField]
    private float maxReleaseVelocity = 12f;

    [SerializeField]
    private float maxReleaseAngularVelocity = 25f;

    [SerializeField]
    private float nearSupportReleaseDistance = 0.15f;

    [SerializeField]
    private float maxDownwardReleaseSpeedNearSupport = 1.5f;

    private Rigidbody rb;
    private Collider[] objectColliders;
    private readonly Collider[] overlapBuffer = new Collider[32];
    private double validateReleasedUntil = double.NegativeInfinity;

    private const float PostReleaseValidationSeconds = 2f;
    private const float GroundSnapDistance = 0.08f;
    private const float GroundSnapMaxSpeed = 0.25f;
    private const float StabilizationMaxSpeed = 1.5f;
    private const float StabilizationMinPenetration = 0.005f;
    private const float StabilizationMaxCorrectionPerStep = 0.02f;

    public InteractableState CurrentInteractableState => interactableState;
    public uint HoldingPlayerNetId => holdingPlayerNetId;
    public bool IsGrabbed => interactableState == InteractableState.Grabbed;
    public bool IsHeldByAnotherClient => IsGrabbed && !isOwned;

    public event System.Action<InteractableState, InteractableState> InteractableStateChanged;

    private void Awake()
    {
        rb = GetComponent<Rigidbody>();
        RefreshColliderCache();
        ApplyRigidbodyDefaults();
    }

    private void OnTransformChildrenChanged()
    {
        RefreshColliderCache();
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

    [ServerCallback]
    private void FixedUpdate()
    {
        if (interactableState != InteractableState.Idle ||
            NetworkTime.time > validateReleasedUntil)
        {
            return;
        }

        StabilizeReleasedPose();
    }

    public bool LocalTryGrab()
    {
        if (!isClient || IsHeldByAnotherClient)
            return false;

        CmdRequestGrab();
        return true;
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

        RuntimeEventEmitter.Emit(
            RuntimeEventType.OwnershipAcquired,
            nameof(RuntimeInteractable),
            "Interactable authority assigned.",
            holdingPlayerNetId,
            netId);
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

        clampedVelocity = ClampReleaseVelocityNearSupport(
            validatedPosition,
            finalRotation,
            clampedVelocity);

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
        validateReleasedUntil = NetworkTime.time + PostReleaseValidationSeconds;

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

        RuntimeEventEmitter.Emit(
            RuntimeEventType.OwnershipReleased,
            nameof(RuntimeInteractable),
            "Interactable authority released.",
            releasedBy,
            netId);
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

        RuntimeEventEmitter.Emit(
            RuntimeEventType.OwnershipReleased,
            nameof(RuntimeInteractable),
            "Interactable authority force released.",
            entityNetId: netId);
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

        if (!rb.isKinematic)
        {
            rb.velocity = Vector3.zero;
            rb.angularVelocity = Vector3.zero;
        }

        rb.isKinematic = true;
    }

    [Server]
    private Vector3 ValidateReleasePosition(
        Vector3 requestedPosition,
        Quaternion requestedRotation,
        uint releasedBy)
    {
        Vector3 position = ClampReleaseDistanceFromCurrentPose(
            requestedPosition);
        position = ClampReleaseDistanceFromHolder(
            position,
            releasedBy);

        if (position != requestedPosition)
        {
            position = ClampReleaseDistanceFromCurrentPose(position);
        }

        if (!HasUsableColliders())
            return position;

        return ResolvePenetration(
            position,
            requestedRotation,
            true);
    }

    [Server]
    private void StabilizeReleasedPose()
    {
        if (rb == null || !HasUsableColliders())
            return;

        if (rb.velocity.magnitude > StabilizationMaxSpeed)
            return;

        Vector3 stablePosition = ResolvePenetration(
            rb.position,
            rb.rotation,
            false,
            StabilizationMinPenetration,
            StabilizationMaxCorrectionPerStep);

        if (stablePosition != rb.position)
        {
            rb.position = stablePosition;
            Physics.SyncTransforms();
        }

        SnapToGroundIfSettled();
    }

    [Server]
    private Vector3 ResolvePenetration(
        Vector3 requestedPosition,
        Quaternion requestedRotation,
        bool includeDynamicRigidbodies,
        float minPenetration = 0f,
        float maxCorrectionPerStep = float.PositiveInfinity)
    {
        Vector3 position = requestedPosition;

        for (int index = 0; index < releaseDepenetrationIterations; index++)
        {
            bool resolvedAnyOverlap = false;

            foreach (Collider sourceCollider in objectColliders)
            {
                if (!IsUsableOwnCollider(sourceCollider))
                {
                    continue;
                }

                GetColliderPose(
                    sourceCollider,
                    position,
                    requestedRotation,
                    out Vector3 colliderPosition,
                    out Quaternion colliderRotation);

                int overlapCount = Physics.OverlapSphereNonAlloc(
                    colliderPosition,
                    GetBroadphaseRadius(sourceCollider),
                    overlapBuffer,
                    Physics.AllLayers,
                    QueryTriggerInteraction.Ignore);

                for (int overlapIndex = 0; overlapIndex < overlapCount; overlapIndex++)
                {
                    Collider overlap = overlapBuffer[overlapIndex];

                    if (overlap == null ||
                        IsOwnCollider(overlap) ||
                        (!includeDynamicRigidbodies && IsDynamicRigidbodyCollider(overlap)))
                    {
                        continue;
                    }

                    if (Physics.ComputePenetration(
                        sourceCollider,
                        colliderPosition,
                        colliderRotation,
                        overlap,
                        overlap.transform.position,
                        overlap.transform.rotation,
                        out Vector3 direction,
                        out float distance))
                    {
                        if (distance <= minPenetration)
                        {
                            continue;
                        }

                        float correctionDistance = Mathf.Min(
                            distance + releaseDepenetrationPadding,
                            maxCorrectionPerStep);
                        position += direction * correctionDistance;
                        resolvedAnyOverlap = true;
                    }
                }
            }

            if (!resolvedAnyOverlap)
                break;
        }

        return position;
    }

    [Server]
    private void SnapToGroundIfSettled()
    {
        if (rb == null ||
            !TryGetCombinedColliderBounds(out Bounds bounds) ||
            GroundSnapDistance <= 0f ||
            rb.velocity.magnitude > GroundSnapMaxSpeed)
        {
            return;
        }

        float rayDistance = bounds.extents.y + GroundSnapDistance;

        if (!Physics.Raycast(
            bounds.center,
            Vector3.down,
            out RaycastHit hit,
            rayDistance,
            Physics.AllLayers,
            QueryTriggerInteraction.Ignore))
        {
            return;
        }

        if (IsOwnCollider(hit.collider) ||
            IsDynamicRigidbodyCollider(hit.collider))
        {
            return;
        }

        float desiredCenterY = hit.point.y + bounds.extents.y + releaseDepenetrationPadding;
        float correction = desiredCenterY - bounds.center.y;

        if (correction >= -0.001f || Mathf.Abs(correction) > GroundSnapDistance)
            return;

        rb.position += Vector3.up * correction;
        Physics.SyncTransforms();
    }

    private bool HasUsableColliders()
    {
        if (objectColliders == null || objectColliders.Length == 0)
            return false;

        foreach (Collider collider in objectColliders)
        {
            if (IsUsableOwnCollider(collider))
                return true;
        }

        return false;
    }

    private bool IsUsableOwnCollider(Collider collider)
    {
        return collider != null &&
            collider.enabled &&
            !collider.isTrigger &&
            IsOwnCollider(collider);
    }

    private bool IsOwnCollider(Collider collider)
    {
        return collider != null &&
            (collider.transform == transform ||
            collider.transform.IsChildOf(transform));
    }

    private void RefreshColliderCache()
    {
        objectColliders = GetComponentsInChildren<Collider>();
    }

    private void ApplyRigidbodyDefaults()
    {
        if (rb == null)
            return;

        if (rb.interpolation == RigidbodyInterpolation.None)
            rb.interpolation = RigidbodyInterpolation.Interpolate;

        if (rb.collisionDetectionMode == CollisionDetectionMode.Discrete)
            rb.collisionDetectionMode = CollisionDetectionMode.ContinuousDynamic;
    }

    private void GetColliderPose(
        Collider collider,
        Vector3 rootPosition,
        Quaternion rootRotation,
        out Vector3 colliderPosition,
        out Quaternion colliderRotation)
    {
        Vector3 localPosition = transform.InverseTransformPoint(
            collider.transform.position);
        Quaternion localRotation =
            Quaternion.Inverse(transform.rotation) * collider.transform.rotation;

        colliderPosition = rootPosition + rootRotation * localPosition;
        colliderRotation = rootRotation * localRotation;
    }

    private float GetBroadphaseRadius(Collider collider)
    {
        return collider.bounds.extents.magnitude + releaseDepenetrationPadding;
    }

    private bool TryGetCombinedColliderBounds(out Bounds combinedBounds)
    {
        combinedBounds = default;
        bool hasBounds = false;

        foreach (Collider collider in objectColliders)
        {
            if (!IsUsableOwnCollider(collider))
                continue;

            if (!hasBounds)
            {
                combinedBounds = collider.bounds;
                hasBounds = true;
            }
            else
            {
                combinedBounds.Encapsulate(collider.bounds);
            }
        }

        return hasBounds;
    }

    private bool IsDynamicRigidbodyCollider(Collider collider)
    {
        Rigidbody attachedRigidbody = collider.attachedRigidbody;
        return attachedRigidbody != null && !attachedRigidbody.isKinematic;
    }

    [Server]
    private Vector3 ClampReleaseVelocityNearSupport(
        Vector3 releasePosition,
        Quaternion releaseRotation,
        Vector3 velocity)
    {
        if (maxDownwardReleaseSpeedNearSupport <= 0f ||
            nearSupportReleaseDistance <= 0f ||
            velocity.y >= -maxDownwardReleaseSpeedNearSupport ||
            !TryGetCombinedColliderBoundsAtPose(
                releasePosition,
                releaseRotation,
                out Bounds bounds))
        {
            return velocity;
        }

        float rayDistance = bounds.extents.y + nearSupportReleaseDistance;

        if (!Physics.Raycast(
                bounds.center,
                Vector3.down,
                out RaycastHit hit,
                rayDistance,
                Physics.AllLayers,
                QueryTriggerInteraction.Ignore))
        {
            return velocity;
        }

        if (IsOwnCollider(hit.collider))
        {
            return velocity;
        }

        velocity.y = Mathf.Max(
            velocity.y,
            -maxDownwardReleaseSpeedNearSupport);

        return velocity;
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
        float currentHolderDistance = Vector3.Distance(
            holderPosition,
            GetCurrentPhysicsPosition());
        float allowedDistance = Mathf.Max(
            maxReleaseDistanceFromHolder,
            currentHolderDistance + maxReleaseDistanceFromCurrentPose);

        if (holderToRelease.magnitude <= allowedDistance)
            return requestedPosition;

        return holderPosition +
            holderToRelease.normalized * allowedDistance;
    }

    [Server]
    private Vector3 ClampReleaseDistanceFromCurrentPose(
        Vector3 requestedPosition)
    {
        if (maxReleaseDistanceFromCurrentPose <= 0f)
            return requestedPosition;

        Vector3 currentPosition = GetCurrentPhysicsPosition();
        Vector3 delta = requestedPosition - currentPosition;

        if (delta.sqrMagnitude <=
            maxReleaseDistanceFromCurrentPose * maxReleaseDistanceFromCurrentPose)
        {
            return requestedPosition;
        }

        return currentPosition +
            delta.normalized * maxReleaseDistanceFromCurrentPose;
    }

    private Vector3 GetCurrentPhysicsPosition()
    {
        return rb != null ? rb.position : transform.position;
    }

    private bool TryGetCombinedColliderBoundsAtPose(
        Vector3 rootPosition,
        Quaternion rootRotation,
        out Bounds combinedBounds)
    {
        combinedBounds = default;
        bool hasBounds = false;

        foreach (Collider collider in objectColliders)
        {
            if (!IsUsableOwnCollider(collider))
                continue;

            GetColliderPose(
                collider,
                rootPosition,
                rootRotation,
                out Vector3 colliderPosition,
                out _);

            Bounds bounds = collider.bounds;
            Vector3 offset = colliderPosition - bounds.center;
            bounds.center += offset;

            if (!hasBounds)
            {
                combinedBounds = bounds;
                hasBounds = true;
            }
            else
            {
                combinedBounds.Encapsulate(bounds.min);
                combinedBounds.Encapsulate(bounds.max);
            }
        }

        return hasBounds;
    }
}
