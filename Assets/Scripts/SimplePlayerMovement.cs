using Mirror;
using UnityEngine;

[RequireComponent(typeof(Rigidbody))]
public class SimplePlayerMovement : NetworkBehaviour
{
    [Header("Movement")]
    public float maxMoveSpeed = 6f;
    public float groundAcceleration = 35f;
    public float airAcceleration = 12f;
    public float groundDrag = 6f;
    public float airDrag = 1f;
    public float jumpForce = 6f;
    public float extraGravity = 18f;
    public float fallResetHeight = -20f;
    public float spawnDistance = 2f;
    public float interactRange = 3f;

    [Header("Feel")]
    public Transform visualRoot;
    public float squashAmount = 0.12f;
    public float squashSpeed = 10f;

    [Header("Camera")]
    public Vector3 cameraOffset = new Vector3(0, 8, -8);
    public Vector3 cameraEulerAngles = new Vector3(45f, 0f, 0f);

    private Rigidbody rb;
    private Camera mainCamera;
    private Transform originalCameraParent;
    private Vector3 originalCameraPosition;
    private Quaternion originalCameraRotation;

    private Rigidbody cachedRigidbody;
    private Collider cachedCollider;

    private Vector3 moveInput;

    private bool jumpRequested;
    private bool autoResetRequested;
    private bool wasGrounded;

    private Vector3 visualBaseScale;
    private Vector3 visualScaleVelocity;

    private SpawnableCarryObject heldObject;

    private readonly System.Collections.Generic.List<SpawnableCarryObject> ownedSpawnedObjects = new();

    [SyncVar(hook = nameof(OnHeldObjectNetIdChanged))]
    private uint heldObjectNetId;

    private void Awake()
    {
        cachedRigidbody = GetComponent<Rigidbody>();
        cachedCollider = GetComponent<Collider>();

        if (visualRoot == null)
        {
            visualRoot = transform;
        }

        visualBaseScale = visualRoot.localScale;

        if (cachedRigidbody != null)
        {
            cachedRigidbody.useGravity = true;
            cachedRigidbody.constraints = RigidbodyConstraints.FreezeRotation;
            cachedRigidbody.interpolation = RigidbodyInterpolation.Interpolate;
            cachedRigidbody.collisionDetectionMode = CollisionDetectionMode.Continuous;
        }
    }

    public override void OnStartLocalPlayer()
    {
        base.OnStartLocalPlayer();

        Debug.Log($"[PLAYER] Local Player Initialized | NetID={netId}");

        mainCamera = Camera.main;

        // FIXED CAMERA NULL CHECK
        if (mainCamera != null)
        {
            originalCameraParent = mainCamera.transform.parent;
            originalCameraPosition = mainCamera.transform.position;
            originalCameraRotation = mainCamera.transform.rotation;

            mainCamera.transform.SetParent(transform);
            mainCamera.transform.localPosition = cameraOffset;
            mainCamera.transform.localRotation = Quaternion.Euler(cameraEulerAngles);
        }
    }

    private void Update()
    {
        if (!isLocalPlayer)
        {
            return;
        }

        Vector3 movement = Vector3.zero;

        if (Input.GetKey(KeyCode.W))
        {
            movement += Vector3.forward;
        }

        if (Input.GetKey(KeyCode.S))
        {
            movement += Vector3.back;
        }

        if (Input.GetKey(KeyCode.A))
        {
            movement += Vector3.left;
        }

        if (Input.GetKey(KeyCode.D))
        {
            movement += Vector3.right;
        }

        // FIXED MOVEMENT INPUT
        moveInput = movement.normalized;

        if (Input.GetKeyDown(KeyCode.Space))
        {
            jumpRequested = true;
        }

        if (Input.GetKeyDown(KeyCode.F))
        {
            CmdSpawnCarryObject();
        }

        if (Input.GetKeyDown(KeyCode.E))
        {
            if (heldObject != null)
            {
                CmdDropHeldObject();
            }
            else
            {
                SpawnableCarryObject nearestObject = FindNearestInteractableObject();

                if (nearestObject != null)
                {
                    CmdPickUpObject(nearestObject.netIdentity);
                }
            }
        }

        if (!autoResetRequested && transform.position.y < fallResetHeight)
        {
            autoResetRequested = true;
            CmdResetMyPosition();
        }
    }

    private void FixedUpdate()
    {
        if (!isLocalPlayer)
        {
            return;
        }

        if (cachedRigidbody == null)
        {
            return;
        }

        bool grounded = IsGrounded();

        ApplyHorizontalMovement(grounded);
        ApplyJump(grounded);
        ApplyExtraGravity(grounded);

        wasGrounded = grounded;
    }

    private void LateUpdate()
    {
        if (!isLocalPlayer)
        {
            return;
        }

        if (mainCamera != null)
        {
            UpdateCameraTransform();
        }

        UpdateVisualSquash();
    }

    public override void OnStopClient()
    {
        base.OnStopClient();

        if (mainCamera != null)
        {
            mainCamera.transform.SetParent(originalCameraParent);
            mainCamera.transform.position = originalCameraPosition;
            mainCamera.transform.rotation = originalCameraRotation;
        }

        if (visualRoot != null)
        {
            visualRoot.localScale = visualBaseScale;
        }

        heldObject = null;

        Debug.Log($"[PLAYER] Player Removed | NetID={netId}");
    }

    [ContextMenu("ResetPosition")]
    public void ResetToSpawn()
    {
        if (isServer && GameManager.Instance != null)
        {
            GameManager.Instance.TryResetPlayer(this);
        }
    }

    [Command]
    public void CmdResetMyPosition()
    {
        if (GameManager.Instance != null && GameManager.Instance.TryResetPlayer(this))
        {
            autoResetRequested = false;

            TargetApplySpawnReset(connectionToClient, transform.position, transform.rotation);
            TargetConfirmReset(connectionToClient);

            RpcConfirmReset();
        }
    }

    [Command]
    private void CmdSpawnCarryObject()
    {
        GameObject spawnPrefab = Resources.Load<GameObject>("SpawnableCarryObject");

        if (spawnPrefab == null)
        {
            Debug.LogWarning("[PLAYER] Spawnable carry object prefab was not found.");
            return;
        }

        CleanupOwnedObjects();

        if (ownedSpawnedObjects.Count >= 5)
        {
            Debug.Log("[PLAYER] Spawn limit reached.");
            return;
        }

        Vector3 spawnPosition =
            transform.position +
            transform.forward * spawnDistance +
            Vector3.up;

        GameObject spawnedObject =
            Instantiate(spawnPrefab, spawnPosition, Quaternion.identity);

        SpawnableCarryObject carryObject =
            spawnedObject.GetComponent<SpawnableCarryObject>();

        if (carryObject == null)
        {
            Destroy(spawnedObject);
            return;
        }

        carryObject.Initialize(netId);

        NetworkServer.Spawn(spawnedObject);

        ownedSpawnedObjects.Add(carryObject);
    }

    [Command]
    private void CmdPickUpObject(NetworkIdentity objectIdentity)
    {
        if (objectIdentity == null)
        {
            return;
        }

        SpawnableCarryObject carryObject =
            objectIdentity.GetComponent<SpawnableCarryObject>();

        if (carryObject == null)
        {
            return;
        }

        if (carryObject.TryPickUp(this))
        {
            heldObjectNetId = carryObject.netId;
        }
    }

    [Command]
    private void CmdDropHeldObject()
    {
        if (heldObjectNetId == 0)
        {
            return;
        }

        if (NetworkServer.spawned.TryGetValue(
            heldObjectNetId,
            out NetworkIdentity heldIdentity))
        {
            SpawnableCarryObject carryObject =
                heldIdentity.GetComponent<SpawnableCarryObject>();

            if (carryObject != null)
            {
                carryObject.Drop();
            }
        }

        heldObjectNetId = 0;
    }

    [Server]
    public void ApplySpawnReset(Vector3 position, Quaternion rotation)
    {
        ApplySpawnResetState(position, rotation);
    }

    [TargetRpc]
    private void TargetConfirmReset(NetworkConnection target)
    {
        Debug.Log($"[PLAYER] Your position was reset | NetID={netId}");
    }

    [TargetRpc]
    private void TargetApplySpawnReset(
        NetworkConnection target,
        Vector3 position,
        Quaternion rotation)
    {
        ApplySpawnResetState(position, rotation);
    }

    [ClientRpc]
    private void RpcConfirmReset()
    {
        if (!isLocalPlayer)
        {
            Debug.Log($"[PLAYER] Position reset | NetID={netId}");
        }
    }

    private void UpdateCameraTransform()
    {
        mainCamera.transform.position = transform.position + cameraOffset;
        mainCamera.transform.rotation = Quaternion.Euler(cameraEulerAngles);
    }

    [Server]
    public void ServerClearHeldObject(SpawnableCarryObject carryObject)
    {
        if (carryObject != null && heldObjectNetId == carryObject.netId)
        {
            heldObjectNetId = 0;
        }
    }

    private void ApplySpawnResetState(Vector3 position, Quaternion rotation)
    {
        autoResetRequested = false;

        transform.SetPositionAndRotation(position, rotation);

        if (cachedRigidbody != null)
        {
            cachedRigidbody.velocity = Vector3.zero;
            cachedRigidbody.angularVelocity = Vector3.zero;
            cachedRigidbody.Sleep();
        }
    }

    private void ApplyHorizontalMovement(bool grounded)
    {
        cachedRigidbody.drag = grounded ? groundDrag : airDrag;

        Vector3 desiredVelocity = moveInput * maxMoveSpeed;

        Vector3 currentVelocity = cachedRigidbody.velocity;

        Vector3 currentHorizontalVelocity =
            new Vector3(currentVelocity.x, 0f, currentVelocity.z);

        Vector3 velocityDelta =
            desiredVelocity - currentHorizontalVelocity;

        float acceleration =
            grounded ? groundAcceleration : airAcceleration;

        Vector3 force = velocityDelta * acceleration;

        cachedRigidbody.AddForce(force, ForceMode.Acceleration);
    }

    private void ApplyJump(bool grounded)
    {
        if (!jumpRequested)
        {
            return;
        }

        jumpRequested = false;

        if (!grounded)
        {
            return;
        }

        Vector3 velocity = cachedRigidbody.velocity;
        velocity.y = 0f;

        cachedRigidbody.velocity = velocity;

        cachedRigidbody.AddForce(
            Vector3.up * jumpForce,
            ForceMode.Impulse);
    }

    private void ApplyExtraGravity(bool grounded)
    {
        if (grounded && cachedRigidbody.velocity.y <= 0f)
        {
            return;
        }

        cachedRigidbody.AddForce(
            Vector3.down * extraGravity,
            ForceMode.Acceleration);
    }

    private bool IsGrounded()
    {
        if (cachedCollider == null)
        {
            Vector3 fallbackOrigin =
                transform.position + Vector3.up * 0.2f;

            return Physics.Raycast(
                fallbackOrigin,
                Vector3.down,
                0.6f);
        }

        Bounds bounds = cachedCollider.bounds;

        float radius =
            Mathf.Max(
                0.05f,
                Mathf.Min(bounds.extents.x, bounds.extents.z) * 0.9f);

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

    private void UpdateVisualSquash()
    {
        if (visualRoot == null)
        {
            return;
        }

        Vector3 targetScale = visualBaseScale;

        float horizontalSpeed =
            new Vector3(
                cachedRigidbody != null ? cachedRigidbody.velocity.x : 0f,
                0f,
                cachedRigidbody != null ? cachedRigidbody.velocity.z : 0f)
            .magnitude;

        bool grounded = IsGrounded();

        if (!grounded)
        {
            targetScale = new Vector3(
                visualBaseScale.x * (1f - squashAmount),
                visualBaseScale.y * (1f + squashAmount),
                visualBaseScale.z * (1f - squashAmount));
        }
        else if (!wasGrounded)
        {
            targetScale = new Vector3(
                visualBaseScale.x * (1f + squashAmount),
                visualBaseScale.y * (1f - squashAmount),
                visualBaseScale.z * (1f + squashAmount));
        }
        else if (horizontalSpeed > 0.1f)
        {
            targetScale = new Vector3(
                visualBaseScale.x * (1f + squashAmount * 0.35f),
                visualBaseScale.y * (1f - squashAmount * 0.35f),
                visualBaseScale.z * (1f + squashAmount * 0.35f));
        }

        visualRoot.localScale = Vector3.SmoothDamp(
            visualRoot.localScale,
            targetScale,
            ref visualScaleVelocity,
            1f / squashSpeed);
    }

    private void OnHeldObjectNetIdChanged(
        uint _,
        uint newHeldObjectNetId)
    {
        heldObject = ResolveCarryObject(newHeldObjectNetId);
    }

    private void CleanupOwnedObjects()
    {
        ownedSpawnedObjects.RemoveAll(
            spawnedObject => spawnedObject == null);
    }

    private SpawnableCarryObject FindNearestInteractableObject()
    {
        SpawnableCarryObject[] allCarryObjects =
            FindObjectsByType<SpawnableCarryObject>(
                FindObjectsSortMode.None);

        SpawnableCarryObject nearestObject = null;

        float nearestDistance = interactRange;

        foreach (SpawnableCarryObject carryObject in allCarryObjects)
        {
            if (
                carryObject == null ||
                carryObject.OwnerNetId != netId ||
                carryObject.IsHeld)
            {
                continue;
            }

            float distance =
                Vector3.Distance(
                    transform.position,
                    carryObject.transform.position);

            if (distance < nearestDistance)
            {
                nearestDistance = distance;
                nearestObject = carryObject;
            }
        }

        return nearestObject;
    }

    private SpawnableCarryObject ResolveCarryObject(uint objectNetId)
    {
        if (objectNetId == 0)
        {
            return null;
        }

        if (NetworkClient.spawned.TryGetValue(
            objectNetId,
            out NetworkIdentity objectIdentity))
        {
            return objectIdentity.GetComponent<SpawnableCarryObject>();
        }

        return null;
    }
}