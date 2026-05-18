using UnityEngine;

[RequireComponent(typeof(Rigidbody))]
public class RigidbodyMovementController : MonoBehaviour
{
    [Header("Movement")]
    public float maxMoveSpeed = 6f;
    public float groundAcceleration = 35f;
    public float airAcceleration = 12f;
    public float groundDrag = 6f;
    public float airDrag = 1f;

    [Header("Jump")]
    public float jumpForce = 10f;
    public float extraGravity = 8f;

    private Rigidbody rb;
    private Collider cachedCollider;

    private Vector3 moveInput;

    private bool jumpRequested;

    private void Awake()
    {
        rb = GetComponent<Rigidbody>();
        cachedCollider = GetComponent<Collider>();

        rb.useGravity = true;
        rb.constraints = RigidbodyConstraints.FreezeRotation;
        rb.interpolation = RigidbodyInterpolation.Interpolate;
    }

    private void Update()
    {
        Vector3 movement = Vector3.zero;

        if (Input.GetKey(KeyCode.W))
            movement += Vector3.forward;

        if (Input.GetKey(KeyCode.S))
            movement += Vector3.back;

        if (Input.GetKey(KeyCode.A))
            movement += Vector3.left;

        if (Input.GetKey(KeyCode.D))
            movement += Vector3.right;

        moveInput = movement.normalized;

        if (Input.GetKeyDown(KeyCode.Space))
        {
            jumpRequested = true;
        }
    }

    private void FixedUpdate()
    {
        bool grounded = IsGrounded();

        ApplyMovement(grounded);
        ApplyJump(grounded);
        ApplyGravity(grounded);
    }

    private void ApplyMovement(bool grounded)
    {
        rb.drag = grounded ? groundDrag : airDrag;

        Vector3 desiredVelocity = moveInput * maxMoveSpeed;

        Vector3 currentVelocity =
            new Vector3(rb.velocity.x, 0f, rb.velocity.z);

        Vector3 velocityDelta =
            desiredVelocity - currentVelocity;

        float acceleration =
            grounded ? groundAcceleration : airAcceleration;

        rb.AddForce(
            velocityDelta * acceleration,
            ForceMode.Acceleration);
    }

    private void ApplyJump(bool grounded)
    {
        if (!jumpRequested)
            return;

        jumpRequested = false;

        if (!grounded)
            return;

        Vector3 velocity = rb.velocity;
        velocity.y = 0f;

        rb.velocity = velocity;

        rb.AddForce(
            Vector3.up * jumpForce,
            ForceMode.Impulse);
    }

    private void ApplyGravity(bool grounded)
    {
        if (grounded && rb.velocity.y <= 0f)
            return;

        rb.AddForce(
            Vector3.down * extraGravity,
            ForceMode.Acceleration);
    }

    private bool IsGrounded()
    {
        if (cachedCollider == null)
            return false;

        Bounds bounds = cachedCollider.bounds;

        float radius =
            Mathf.Min(bounds.extents.x, bounds.extents.z) * 0.9f;

        Vector3 origin =
            bounds.center + Vector3.up * 0.05f;

        float checkDistance =
            bounds.extents.y + 0.15f;

        return Physics.SphereCast(
            origin,
            radius,
            Vector3.down,
            out _,
            checkDistance);
    }
}