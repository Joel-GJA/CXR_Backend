using Mirror;
using UnityEngine;

public class SimplePlayerMovement : NetworkBehaviour
{
    [Header("Movement")]
    public float moveSpeed = 5f;

    [Header("Camera")]
    public Vector3 cameraOffset = new Vector3(0, 8, -8);

    private Camera mainCamera;
    private Transform originalCameraParent;
    private Vector3 originalCameraPosition;
    private Quaternion originalCameraRotation;

    public override void OnStartLocalPlayer()
    {
        base.OnStartLocalPlayer();

        Debug.Log($"[PLAYER] Local Player Initialized | NetID={netId}");

        mainCamera = Camera.main != null ? Camera.main : FindFirstObjectByType<Camera>();

        if (mainCamera != null)
        {
            originalCameraParent = mainCamera.transform.parent;
            originalCameraPosition = mainCamera.transform.position;
            originalCameraRotation = mainCamera.transform.rotation;
            mainCamera.enabled = true;
            mainCamera.transform.SetParent(transform);
            mainCamera.transform.localPosition = cameraOffset;
            mainCamera.transform.localRotation = Quaternion.Euler(45f, 0f, 0f);
        }
        else
        {
            Debug.LogWarning("[PLAYER] No camera found for the local player.");
        }
    }

    private void Update()
    {
        if (!isLocalPlayer) return;

        Vector3 movement = Vector3.zero;

        if (Input.GetKey(KeyCode.W))
            movement += Vector3.forward;

        if (Input.GetKey(KeyCode.S))
            movement += Vector3.back;

        if (Input.GetKey(KeyCode.A))
            movement += Vector3.left;

        if (Input.GetKey(KeyCode.D))
            movement += Vector3.right;

        movement = movement.normalized;

        transform.position += movement * moveSpeed * Time.deltaTime;
    }

    public override void OnStopClient()
    {
        base.OnStopClient();

        if (mainCamera != null)
        {
            if (mainCamera.transform.parent == transform)
            {
                mainCamera.transform.SetParent(originalCameraParent);
            }

            if (originalCameraParent == null)
            {
                mainCamera.transform.position = originalCameraPosition;
                mainCamera.transform.rotation = originalCameraRotation;
            }
        }

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
            TargetConfirmReset(connectionToClient);
            RpcConfirmReset();
        }
    }

    [Server]
    public void ApplySpawnReset(Vector3 position, Quaternion rotation)
    {
        transform.SetPositionAndRotation(position, rotation);
    }

    [TargetRpc]
    private void TargetConfirmReset(NetworkConnection target)
    {
        Debug.Log($"[PLAYER] Your position was reset | NetID={netId}");
    }

    [ClientRpc]
    private void RpcConfirmReset()
    {
        if (!isLocalPlayer)
        {
            Debug.Log($"[PLAYER] Position reset | NetID={netId}");
        }
    }
}
