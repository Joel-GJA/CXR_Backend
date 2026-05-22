using Mirror;
using UnityEngine;

[DefaultExecutionOrder(-100)]
public class XRTrackingBridge : MonoBehaviour
{
    [Header("XR Origin Reference (the transform to move)")]
    [SerializeField] private Transform xrOrigin;

    [Header("Source XR Transforms (from XROrigin)")]
    [SerializeField] private Transform headSource;
    [SerializeField] private Transform leftHandSource;
    [SerializeField] private Transform rightHandSource;

    [Header("Keyboard Fallback")]
    [SerializeField] private float moveSpeed = 3f;
    [SerializeField] private float lookSpeed = 60f;
    [SerializeField] private KeyCode toggleKey = KeyCode.T;

    private XRParticipantRuntime localXrRig;
    private bool useKeyboardFallback;
    public bool IsUsingKeyboard => useKeyboardFallback;
    private Camera xrCamera;
    private Transform cameraOffset;
    private float yaw;
    private float pitch;

    public void SetReferences(Transform origin, Transform head, Transform leftHand, Transform rightHand)
    {
        xrOrigin = origin;
        headSource = head;
        leftHandSource = leftHand;
        rightHandSource = rightHand;
        Initialize();
    }

    private void Start()
    {
        Initialize();
    }

    private void Initialize()
    {
        if (headSource != null)
            xrCamera = headSource.GetComponent<Camera>();

        if (xrOrigin != null)
            cameraOffset = xrOrigin.Find("CameraOffset");

        Camera fallback = Camera.main;
        if (fallback != null && fallback != xrCamera)
            fallback.gameObject.SetActive(false);

        useKeyboardFallback = true;

        if (xrCamera != null)
        {
            xrCamera.gameObject.SetActive(true);
            xrCamera.tag = "MainCamera";
        }

        FixCanvasForXR();
    }

    private void LateUpdate()
    {
        if (Input.GetKeyDown(KeyCode.F3)) FindObjectOfType<XRMultiplayerRuntimeFacade>()?.StartHost();
        if (Input.GetKeyDown(KeyCode.F4)) FindObjectOfType<XRMultiplayerRuntimeFacade>()?.StartServer();
        if (Input.GetKeyDown(KeyCode.F5)) FindObjectOfType<XRMultiplayerRuntimeFacade>()?.StartClient("localhost");
        if (Input.GetKeyDown(KeyCode.F6)) FindObjectOfType<XRMultiplayerRuntimeFacade>()?.Stop();

        if (Input.GetKeyDown(toggleKey))
        {
            useKeyboardFallback = !useKeyboardFallback;
            Cursor.lockState = useKeyboardFallback ? CursorLockMode.Locked : CursorLockMode.None;
            Cursor.visible = !useKeyboardFallback;
            Debug.Log($"[XR_PRESENCE] TrackingBridge mode: {(useKeyboardFallback ? "Keyboard" : "XR")}");
        }

        if (useKeyboardFallback)
            UpdateKeyboard();

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
            Debug.Log("[XR_PRESENCE] XRTrackingBridge found local XRParticipantRuntime");
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
        if (xrOrigin == null) return;

        yaw += Input.GetAxis("Mouse X") * lookSpeed * Time.deltaTime;
        pitch -= Input.GetAxis("Mouse Y") * lookSpeed * Time.deltaTime;
        pitch = Mathf.Clamp(pitch, -90f, 90f);

        xrOrigin.rotation = Quaternion.Euler(0f, yaw, 0f);

        Vector3 move = Vector3.zero;
        if (Input.GetKey(KeyCode.W)) move += Vector3.forward;
        if (Input.GetKey(KeyCode.S)) move += Vector3.back;
        if (Input.GetKey(KeyCode.A)) move += Vector3.left;
        if (Input.GetKey(KeyCode.D)) move += Vector3.right;

        float axisX = Input.GetAxis("Horizontal");
        float axisY = Input.GetAxis("Vertical");
        if (Mathf.Abs(axisX) > 0.1f || Mathf.Abs(axisY) > 0.1f)
            move += new Vector3(axisX, 0f, axisY);

        if (move != Vector3.zero)
        {
            move = xrOrigin.rotation * move.normalized;
            xrOrigin.position += move * (moveSpeed * Time.deltaTime);
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
