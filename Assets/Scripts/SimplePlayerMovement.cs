using Mirror;
using UnityEngine;

public class SimplePlayerMovement : NetworkBehaviour
{
    [Header("Movement")]
    public float moveSpeed = 5f;

    [Header("Camera")]
    public Vector3 cameraOffset = new Vector3(0, 8, -8);

    private Camera mainCamera;

    public override void OnStartLocalPlayer()
    {
        base.OnStartLocalPlayer();

        Debug.Log($"[PLAYER] Local Player Initialized | NetID={netId}");

        mainCamera = Camera.main;

        if (mainCamera != null)
        {
            mainCamera.transform.SetParent(transform);
            mainCamera.transform.localPosition = cameraOffset;
            mainCamera.transform.localRotation = Quaternion.Euler(45f, 0f, 0f);
        }
    }

    void Update()
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

        Debug.Log($"[PLAYER] Player Removed | NetID={netId}");
    }
}