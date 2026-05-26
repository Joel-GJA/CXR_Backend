using UnityEngine;

[DisallowMultipleComponent]
public sealed class XRHandPhysicsContactProxy : MonoBehaviour
{
    private const float DefaultRadius = 0.09f;
    private const float DefaultMaxFollowSpeed = 12f;
    private const float DefaultMinPushSpeed = 0.05f;
    private const float DefaultTangentialTransfer = 0.2f;
    private const float DefaultMaxVelocityChangePerStep = 0.35f;
    private const float DefaultMaxPushSpeed = 3.5f;

    private Transform trackedTransform;
    private Transform ownerRoot;
    private Rigidbody proxyRigidbody;
    private SphereCollider proxyCollider;
    private Vector3 handVelocity;
    private float pushStrengthMultiplier = 1f;

    public void Initialize(
        Transform trackedTransform,
        Transform ownerRoot,
        float radius = DefaultRadius,
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

        proxyCollider = GetComponent<SphereCollider>();
        if (proxyCollider == null)
        {
            proxyCollider = gameObject.AddComponent<SphereCollider>();
        }

        proxyCollider.isTrigger = true;
        proxyCollider.radius = Mathf.Max(0.01f, radius);

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
            handVelocity = Vector3.zero;
            return;
        }

        Vector3 targetPosition = trackedTransform.position;
        handVelocity =
            (targetPosition - proxyRigidbody.position) /
            Mathf.Max(0.0001f, fixedDeltaTime);
        handVelocity = Vector3.ClampMagnitude(
            handVelocity,
            DefaultMaxFollowSpeed);

        proxyRigidbody.MovePosition(targetPosition);
        proxyRigidbody.MoveRotation(trackedTransform.rotation);
    }

    private void OnTriggerStay(Collider other)
    {
        if (proxyRigidbody == null ||
            handVelocity.magnitude < DefaultMinPushSpeed)
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

        Vector3 contactPoint = other.ClosestPoint(proxyRigidbody.position);
        Vector3 surfaceNormal =
            otherRigidbody.worldCenterOfMass - proxyRigidbody.position;

        if (surfaceNormal.sqrMagnitude <= 0.0001f)
        {
            surfaceNormal = handVelocity.normalized;
        }
        else
        {
            surfaceNormal.Normalize();
        }

        float inwardSpeed =
            Vector3.Dot(handVelocity, surfaceNormal);

        if (inwardSpeed <= DefaultMinPushSpeed)
        {
            return;
        }

        Vector3 desiredVelocity =
            surfaceNormal * inwardSpeed +
            Vector3.ProjectOnPlane(
                handVelocity,
                surfaceNormal) * DefaultTangentialTransfer;
        desiredVelocity = Vector3.ClampMagnitude(
            desiredVelocity,
            DefaultMaxPushSpeed * pushStrengthMultiplier);

        Vector3 currentPointVelocity =
            otherRigidbody.GetPointVelocity(contactPoint);
        Vector3 velocityChange =
            desiredVelocity - currentPointVelocity;
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
}
