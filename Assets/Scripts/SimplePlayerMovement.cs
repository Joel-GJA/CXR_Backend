using Mirror;
using UnityEngine;

[RequireComponent(typeof(Rigidbody))]
public class SimplePlayerMovement : NetworkBehaviour
{
    [Header("Movement")]
    public float moveSpeed = 5f;

    [Header("Jump")]
    public float jumpForce = 5f;

    [Header("Camera")]
    public Vector3 cameraOffset = new Vector3(0, 8, -8);

    private Rigidbody rb;
    private Camera mainCamera;

    private bool isGrounded = true;

    // =========================
    // INITIALIZATION
    // =========================

    private void Awake()
    {
        rb = GetComponent<Rigidbody>();
    }

    public override void OnStartLocalPlayer()
    {
        base.OnStartLocalPlayer();

        Debug.Log($"[PLAYER] Local Player Initialized | NetID={netId}");

        SetupCamera();
    }

    // =========================
    // CAMERA MANAGEMENT
    // =========================

    private void SetupCamera()
    {
        mainCamera = Camera.main;

        if (mainCamera == null)
        {
            Debug.LogWarning("[CAMERA] No Main Camera Found");
            return;
        }

        // Reset any old parent
        mainCamera.transform.SetParent(null);

        // Attach to new player
        mainCamera.transform.SetParent(transform);

        mainCamera.transform.localPosition = cameraOffset;
        mainCamera.transform.localRotation = Quaternion.Euler(45f, 0f, 0f);

        Debug.Log($"[CAMERA] Attached To Player | NetID={netId}");
    }

    private void CleanupCamera()
    {
        if (mainCamera == null) return;

        // Detach camera from destroyed player
        mainCamera.transform.SetParent(null);

        Debug.Log($"[CAMERA] Detached From Player | NetID={netId}");
    }

    // =========================
    // INPUT
    // =========================

    private void Update()
    {
        if (!isLocalPlayer) return;

        HandleJump();
    }

    private void FixedUpdate()
    {
        if (!isLocalPlayer) return;

        HandleMovement();
    }

    private void HandleMovement()
    {
        float horizontal = Input.GetAxisRaw("Horizontal");
        float vertical = Input.GetAxisRaw("Vertical");

        Vector3 direction = new Vector3(horizontal, 0f, vertical).normalized;

        Vector3 velocity = direction * moveSpeed;

        Vector3 targetVelocity = new Vector3(
            velocity.x,
            rb.velocity.y,
            velocity.z
        );

        rb.velocity = targetVelocity;
    }

    private void HandleJump()
    {
        if (Input.GetKeyDown(KeyCode.Space) && isGrounded)
        {
            rb.AddForce(Vector3.up * jumpForce, ForceMode.Impulse);

            isGrounded = false;
        }
    }

    // =========================
    // GROUND CHECK
    // =========================

    private void OnCollisionEnter(Collision collision)
    {
        if (collision.gameObject.CompareTag("Ground"))
        {
            isGrounded = true;
        }
    }

    // =========================
    // CLEANUP
    // =========================

    public override void OnStopLocalPlayer()
    {
        base.OnStopLocalPlayer();

        CleanupCamera();

        Debug.Log($"[PLAYER] Local Player Stopped | NetID={netId}");
    }

    public override void OnStopClient()
    {
        base.OnStopClient();

        Debug.Log($"[PLAYER] Player Removed | NetID={netId}");
    }
}