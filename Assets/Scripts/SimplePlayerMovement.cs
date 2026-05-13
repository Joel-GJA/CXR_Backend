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
        // Only allow local player to control this object
        if (!isLocalPlayer) return;

        Vector3 movement = Vector3.zero;

        // WASD Controls
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

        // Normalize diagonal movement
        movement = movement.normalized;

        // Move player
        transform.position += movement * moveSpeed * Time.deltaTime;

        //// Only allow local player to control this object
        //if (!isLocalPlayer) return;

        //float horizontal = Input.GetAxis("Horizontal");
        //float vertical = Input.GetAxis("Vertical");

        //Vector3 movement = new Vector3(horizontal, 0f, vertical);

        //transform.position += movement * moveSpeed * Time.deltaTime;
    }
}