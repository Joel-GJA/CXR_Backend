using UnityEngine;

[DisallowMultipleComponent]
public sealed class XRBodyPhysicsContactProxy : MonoBehaviour
{
    private const float DefaultRadius = 0.22f;
    private const float DefaultHeight = 1.4f;
    private const float DefaultCenterY = 0.72f;
    private const float DefaultMaxFollowSpeed = 6f;
    private const float DefaultMinPushSpeed = 0.03f;
    private const float DefaultTangentialTransfer = 0.12f;
    private const float DefaultMaxVelocityChangePerStep = 0.22f;
    private const float DefaultMaxPushSpeed = 2.4f;

    private Transform trackedTransform;
    private Transform ownerRoot;
    private Rigidbody proxyRigidbody;
    private CapsuleCollider proxyCollider;
    private Vector3 bodyVelocity;
    private float pushStrengthMultiplier = 1f;
    private readonly Collider[] overlapBuffer = new Collider[16];

    public void Initialize(
        Transform trackedTransform,
        Transform ownerRoot,
        float radius = DefaultRadius,
        float height = DefaultHeight,
        float centerY = DefaultCenterY,
        float pushStrengthMultiplier = 1f)
    {
        this.trackedTransform = trackedTransform;
        this.ownerRoot = ownerRoot;
        this.pushStrengthMultiplier = Mathf.Max(
            0.1f,
            pushStrengthMultiplier);

        proxyRigidbody = GetComponent<Rigidbody>();
        if (proxyRigidbody == null)
        {
            proxyRigidbody = gameObject.AddComponent<Rigidbody>();
        }

        proxyRigidbody.isKinematic = true;
        proxyRigidbody.useGravity = false;
        proxyRigidbody.interpolation = RigidbodyInterpolation.None;
        proxyRigidbody.collisionDetectionMode =
            CollisionDetectionMode.ContinuousSpeculative;

        proxyCollider = GetComponent<CapsuleCollider>();
        if (proxyCollider == null)
        {
            proxyCollider = gameObject.AddComponent<CapsuleCollider>();
        }

        proxyCollider.isTrigger = true;
        proxyCollider.direction = 1;
        proxyCollider.radius = Mathf.Max(0.05f, radius);
        proxyCollider.height = Mathf.Max(
            proxyCollider.radius * 2f,
            height);
        proxyCollider.center = new Vector3(0f, centerY, 0f);

        if (trackedTransform != null)
        {
            transform.SetPositionAndRotation(
                trackedTransform.position,
                trackedTransform.rotation);
        }
    }

    public void Tick(float fixedDeltaTime)
    {
        if (trackedTransform == null || proxyRigidbody == null)
        {
            bodyVelocity = Vector3.zero;
            return;
        }

        Vector3 previousPosition = proxyRigidbody.position;
        Vector3 targetPosition = trackedTransform.position;
        bodyVelocity =
            (targetPosition - proxyRigidbody.position) /
            Mathf.Max(0.0001f, fixedDeltaTime);
        bodyVelocity = Vector3.ClampMagnitude(
            bodyVelocity,
            DefaultMaxFollowSpeed);

        proxyRigidbody.MovePosition(targetPosition);
        proxyRigidbody.MoveRotation(trackedTransform.rotation);

        ProcessSweepContacts(previousPosition, targetPosition);
        ProcessOverlapContacts(targetPosition);
    }

    private void OnTriggerStay(Collider other)
    {
        ApplyPushToCollider(other);
    }

    private void ProcessSweepContacts(
        Vector3 previousPosition,
        Vector3 targetPosition)
    {
        if (proxyCollider == null ||
            bodyVelocity.magnitude < DefaultMinPushSpeed)
        {
            return;
        }

        Vector3 movement = targetPosition - previousPosition;
        float distance = movement.magnitude;
        if (distance <= 0.0001f)
        {
            return;
        }

        Vector3 direction = movement / distance;
        GetCapsuleWorldPoints(
            previousPosition,
            out Vector3 point0,
            out Vector3 point1);

        int hitCount = Physics.OverlapCapsuleNonAlloc(
            point0 + direction * distance,
            point1 + direction * distance,
            proxyCollider.radius,
            overlapBuffer,
            Physics.AllLayers,
            QueryTriggerInteraction.Ignore);

        for (int index = 0; index < hitCount; index++)
        {
            ApplyPushToCollider(overlapBuffer[index]);
            overlapBuffer[index] = null;
        }
    }

    private void ProcessOverlapContacts(Vector3 targetPosition)
    {
        if (proxyCollider == null ||
            bodyVelocity.magnitude < DefaultMinPushSpeed)
        {
            return;
        }

        GetCapsuleWorldPoints(
            targetPosition,
            out Vector3 point0,
            out Vector3 point1);

        int hitCount = Physics.OverlapCapsuleNonAlloc(
            point0,
            point1,
            proxyCollider.radius,
            overlapBuffer,
            Physics.AllLayers,
            QueryTriggerInteraction.Ignore);

        for (int index = 0; index < hitCount; index++)
        {
            ApplyPushToCollider(overlapBuffer[index]);
            overlapBuffer[index] = null;
        }
    }

    private void ApplyPushToCollider(Collider other)
    {
        if (proxyRigidbody == null ||
            bodyVelocity.magnitude < DefaultMinPushSpeed ||
            other == null)
        {
            return;
        }

        if (ownerRoot != null && other.transform.IsChildOf(ownerRoot))
        {
            return;
        }

        Rigidbody otherRigidbody = other.attachedRigidbody;
        if (otherRigidbody == null ||
            otherRigidbody == proxyRigidbody ||
            otherRigidbody.isKinematic)
        {
            return;
        }

        RuntimeInteractable interactable =
            otherRigidbody.GetComponent<RuntimeInteractable>() ??
            other.GetComponentInParent<RuntimeInteractable>();

        if (interactable != null && interactable.IsGrabbed)
        {
            return;
        }

        Vector3 contactPoint = other.ClosestPoint(proxyRigidbody.worldCenterOfMass);
        Vector3 pushDirection = Vector3.ProjectOnPlane(
            bodyVelocity,
            Vector3.up);

        if (pushDirection.sqrMagnitude <= 0.0001f)
        {
            return;
        }

        pushDirection.Normalize();

        Vector3 desiredVelocity =
            pushDirection * Mathf.Min(
                bodyVelocity.magnitude,
                DefaultMaxPushSpeed * pushStrengthMultiplier) +
            Vector3.ProjectOnPlane(
                bodyVelocity,
                pushDirection) * DefaultTangentialTransfer;
        desiredVelocity = Vector3.ClampMagnitude(
            desiredVelocity,
            DefaultMaxPushSpeed * pushStrengthMultiplier);

        Vector3 currentPointVelocity =
            otherRigidbody.GetPointVelocity(contactPoint);
        Vector3 velocityChange =
            desiredVelocity - currentPointVelocity;
        velocityChange.y = 0f;
        velocityChange = Vector3.ClampMagnitude(
            velocityChange,
            DefaultMaxVelocityChangePerStep * pushStrengthMultiplier);

        if (velocityChange.sqrMagnitude <= 0.0001f)
        {
            return;
        }

        otherRigidbody.AddForceAtPosition(
            velocityChange,
            contactPoint,
            ForceMode.VelocityChange);
    }

    private void GetCapsuleWorldPoints(
        Vector3 rootPosition,
        out Vector3 point0,
        out Vector3 point1)
    {
        Vector3 center = rootPosition + proxyCollider.center;
        float halfSegment = Mathf.Max(
            0f,
            (proxyCollider.height * 0.5f) - proxyCollider.radius);

        point0 = center + Vector3.up * halfSegment;
        point1 = center - Vector3.up * halfSegment;
    }
}
