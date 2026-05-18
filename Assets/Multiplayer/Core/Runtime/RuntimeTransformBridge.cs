using UnityEngine;

public class RuntimeTransformBridge : MonoBehaviour
{
    [Header("Runtime References")]
    [SerializeField]
    private Transform physicsRoot;

    [SerializeField]
    private Transform rigMountPoint;

    [SerializeField]
    private Transform cameraRoot;

    private void LateUpdate()
    {
        if (physicsRoot == null)
            return;

        // -------------------------
        // Runtime root follows physics
        // -------------------------

        transform.position = physicsRoot.position;
        transform.rotation = physicsRoot.rotation;

        // -------------------------
        // Rig follows runtime root
        // -------------------------

        if (rigMountPoint != null)
        {
            rigMountPoint.position = transform.position;
            rigMountPoint.rotation = transform.rotation;
        }

        // -------------------------
        // Camera follows runtime root
        // -------------------------

        if (cameraRoot != null)
        {
            cameraRoot.position = transform.position;
            cameraRoot.rotation = transform.rotation;
        }
    }
}