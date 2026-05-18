using Mirror;
using UnityEngine;

public class CameraFollowBinder : NetworkBehaviour
{
    public Vector3 cameraOffset = new Vector3(0, 8, -8);
    public Vector3 cameraEulerAngles = new Vector3(45f, 0f, 0f);

    private Camera mainCamera;

    private Transform originalParent;
    private Vector3 originalPosition;
    private Quaternion originalRotation;

    public override void OnStartLocalPlayer()
    {
        base.OnStartLocalPlayer();

        mainCamera = Camera.main;

        if (mainCamera == null)
            return;

        originalParent = mainCamera.transform.parent;
        originalPosition = mainCamera.transform.position;
        originalRotation = mainCamera.transform.rotation;

        mainCamera.transform.SetParent(transform);
        mainCamera.transform.localPosition = cameraOffset;
        mainCamera.transform.localRotation =
            Quaternion.Euler(cameraEulerAngles);
    }

    private void LateUpdate()
    {
        if (!isLocalPlayer || mainCamera == null)
            return;

        mainCamera.transform.position =
            transform.position + cameraOffset;

        mainCamera.transform.rotation =
            Quaternion.Euler(cameraEulerAngles);
    }

    public override void OnStopClient()
    {
        base.OnStopClient();

        if (mainCamera == null)
            return;

        mainCamera.transform.SetParent(originalParent);
        mainCamera.transform.position = originalPosition;
        mainCamera.transform.rotation = originalRotation;
    }
}