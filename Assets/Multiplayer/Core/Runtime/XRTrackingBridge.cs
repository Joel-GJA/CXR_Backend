using System.Collections.Generic;
using Mirror;
using UnityEngine;
using UnityEngine.XR;

[DefaultExecutionOrder(-100)]
public class XRTrackingBridge : MonoBehaviour
{
    [Header("Source XR Transforms (from XROrigin)")]
    [SerializeField] private Transform headSource;
    [SerializeField] private Transform leftHandSource;
    [SerializeField] private Transform rightHandSource;

    [Header("Movement")]
    [SerializeField] private float moveSpeed = 3f;

    [Header("XR Locomotion")]
    [SerializeField] private float turnSpeed = 120f;

    [Header("Keyboard Fallback")]
    [SerializeField] private float lookSpeed = 60f;
    [SerializeField] private KeyCode toggleKey = KeyCode.T;

    private XRParticipantRuntime localXrRig;
    private bool useKeyboardFallback;
    public bool IsUsingKeyboard => useKeyboardFallback;
    private Camera xrCamera;
    private Transform cameraOffset;
    private float yaw;
    private float pitch;
    private readonly List<InputDevice> inputDevices = new List<InputDevice>();

    private void Start()
    {
        if (headSource != null)
            xrCamera = headSource.GetComponent<Camera>();

        cameraOffset = transform.Find("CameraOffset");

        Camera fallback = Camera.main;
        if (fallback != null && fallback != xrCamera)
            fallback.gameObject.SetActive(false);

        useKeyboardFallback = !XRSettings.isDeviceActive;

        inputDevices.Clear();
        InputDevices.GetDevices(inputDevices);
        Debug.Log($"[XR_PRESENCE] XR devices found: {inputDevices.Count}");
        foreach (InputDevice d in inputDevices)
            Debug.Log($"[XR_PRESENCE]   Device: {d.name} characteristics={d.characteristics}");

        if (xrCamera != null)
        {
            xrCamera.gameObject.SetActive(true);
            xrCamera.tag = "MainCamera";
        }

        FixCanvasForXR();
    }

    private void LateUpdate()
    {
        if (Input.GetKeyDown(toggleKey))
        {
            useKeyboardFallback = !useKeyboardFallback;
            Cursor.lockState = useKeyboardFallback ? CursorLockMode.Locked : CursorLockMode.None;
            Cursor.visible = !useKeyboardFallback;
            Debug.Log($"[XR_PRESENCE] TrackingBridge mode: {(useKeyboardFallback ? "Keyboard" : "XR")}");
        }

        if (useKeyboardFallback)
        {
            UpdateKeyboard();
        }
        else
        {
            UpdateXRLocomotion();
        }

        if (!NetworkClient.active)
            return;

        if (localXrRig == null)
        {
            FindLocalRig();
            if (localXrRig == null)
                return;
        }

        UpdateFromSources();
    }

    private void FindLocalRig()
    {
        if (NetworkClient.localPlayer == null)
            return;

        localXrRig = NetworkClient.localPlayer.GetComponent<XRParticipantRuntime>();
        if (localXrRig != null)
        {
            Debug.Log("[XR_PRESENCE] XRTrackingBridge found local XRParticipantRuntime");
        }
    }

    private void UpdateFromSources()
    {
        if (headSource != null)
            SyncTransform(headSource, localXrRig.HeadTransform);

        if (leftHandSource != null)
            SyncTransform(leftHandSource, localXrRig.LeftHandTransform);

        if (rightHandSource != null)
            SyncTransform(rightHandSource, localXrRig.RightHandTransform);
    }

    private static void SyncTransform(Transform src, Transform dst)
    {
        if (dst == null) return;
        dst.SetPositionAndRotation(src.position, src.rotation);
    }

    private void UpdateKeyboard()
    {
        yaw += Input.GetAxis("Mouse X") * lookSpeed * Time.deltaTime;
        pitch -= Input.GetAxis("Mouse Y") * lookSpeed * Time.deltaTime;
        pitch = Mathf.Clamp(pitch, -90f, 90f);

        transform.rotation = Quaternion.Euler(0f, yaw, 0f);

        Vector3 move = Vector3.zero;
        if (Input.GetKey(KeyCode.W)) move += Vector3.forward;
        if (Input.GetKey(KeyCode.S)) move += Vector3.back;
        if (Input.GetKey(KeyCode.A)) move += Vector3.left;
        if (Input.GetKey(KeyCode.D)) move += Vector3.right;

        float axisX = Input.GetAxis("Horizontal");
        float axisY = Input.GetAxis("Vertical");
        if (Mathf.Abs(axisX) > 0.1f || Mathf.Abs(axisY) > 0.1f)
        {
            move += new Vector3(axisX, 0f, axisY);
        }

        if (move != Vector3.zero)
        {
            move = transform.rotation * move.normalized;
            transform.position += move * (moveSpeed * Time.deltaTime);
        }

        if (cameraOffset != null)
        {
            cameraOffset.localPosition = new Vector3(0f, 1.6f, 0f);
            cameraOffset.localRotation = Quaternion.identity;
        }

        if (xrCamera != null)
        {
            xrCamera.transform.localPosition = Vector3.zero;
            xrCamera.transform.localRotation = Quaternion.Euler(pitch, 0f, 0f);
        }

        if (headSource != null && localXrRig != null)
            SyncTransform(headSource, localXrRig.HeadTransform);
    }

    private void UpdateXRLocomotion()
    {
        Transform head = headSource;
        if (head == null) return;

        Vector3 forward = Vector3.ProjectOnPlane(head.forward, Vector3.up).normalized;
        Vector3 right = Vector3.ProjectOnPlane(head.right, Vector3.up).normalized;

        Vector2 moveInput = GetThumbstick(true);
        if (moveInput == Vector2.zero)
        {
            float ax = Input.GetAxis("Horizontal");
            float ay = Input.GetAxis("Vertical");
            if (Mathf.Abs(ax) > 0.1f || Mathf.Abs(ay) > 0.1f)
                moveInput = new Vector2(ax, ay);
        }

        if (moveInput != Vector2.zero)
        {
            Vector3 move = (forward * moveInput.y + right * moveInput.x) * (moveSpeed * Time.deltaTime);
            transform.position += move;
        }

        Vector2 turnInput = GetThumbstick(false);
        float turnAngle = turnInput.x * turnSpeed * Time.deltaTime;
        if (Mathf.Abs(turnAngle) > 0.01f)
        {
            transform.Rotate(0f, turnAngle, 0f);
        }
    }

    private Vector2 GetThumbstick(bool leftHand)
    {
        InputDeviceCharacteristics mask = InputDeviceCharacteristics.HeldInHand | InputDeviceCharacteristics.Controller;
        mask |= leftHand ? InputDeviceCharacteristics.Left : InputDeviceCharacteristics.Right;

        InputDevices.GetDevices(inputDevices);
        foreach (InputDevice device in inputDevices)
        {
            if ((device.characteristics & mask) == mask)
            {
                if (device.TryGetFeatureValue(CommonUsages.primary2DAxis, out Vector2 value) && value.sqrMagnitude > 0.001f)
                {
                    Debug.Log($"[XR_PRESENCE] {(leftHand ? "Left" : "Right")} thumbstick: {value}");
                    return value;
                }
            }
        }
        return Vector2.zero;
    }

    private void FixCanvasForXR()
    {
        Canvas[] canvases = FindObjectsByType<Canvas>(FindObjectsSortMode.None);
        foreach (Canvas canvas in canvases)
        {
            if (canvas.renderMode == RenderMode.ScreenSpaceOverlay && xrCamera != null)
            {
                canvas.renderMode = RenderMode.ScreenSpaceCamera;
                canvas.worldCamera = xrCamera;
                canvas.planeDistance = 0.5f;
            }
        }
    }
}
