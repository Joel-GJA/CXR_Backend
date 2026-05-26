using Mirror;
using UnityEngine;

public class XRParticipantRuntime : NetworkBehaviour
{
    private const float HandContactRadius = 0.09f;
    private const float BodyContactRadius = 0.22f;
    private const float BodyContactHeight = 1.4f;
    private const float BodyContactCenterY = 0.72f;
    private const float RemoteHandPushStrengthMultiplier = 1.6f;
    private const float RemoteBodyPushStrengthMultiplier = 1.75f;

    [Header("XR Transform Anchors")]
    [SerializeField]
    private Transform headTransform;

    [SerializeField]
    private Transform leftHandTransform;

    [SerializeField]
    private Transform rightHandTransform;

    [Header("Remote Visual Proxies")]
    [SerializeField]
    private GameObject headProxy;

    [SerializeField]
    private GameObject leftHandProxy;

    [SerializeField]
    private GameObject rightHandProxy;

    public Transform HeadTransform => headTransform;
    public Transform LeftHandTransform => leftHandTransform;
    public Transform RightHandTransform => rightHandTransform;

    private XRRuntimeParticipant xrParticipant;
    private XRHandPhysicsContactProxy leftHandContactProxy;
    private XRHandPhysicsContactProxy rightHandContactProxy;
    private XRBodyPhysicsContactProxy bodyContactProxy;

    private void Awake()
    {
        ResolveAnchors();
    }

    private void ResolveAnchors()
    {
        xrParticipant = GetComponent<XRRuntimeParticipant>();

        if (headTransform == null && xrParticipant != null)
            headTransform = xrParticipant.HeadRoot;

        if (leftHandTransform == null && xrParticipant != null)
            leftHandTransform = xrParticipant.LeftHandRoot;

        if (rightHandTransform == null && xrParticipant != null)
            rightHandTransform = xrParticipant.RightHandRoot;
    }

    public override void OnStartLocalPlayer()
    {
        base.OnStartLocalPlayer();

        ConfigureLocalRig();

        Debug.Log(
            "[XR_PRESENCE] Local Rig Started | " +
            $"NetID={netId}");
    }

    public override void OnStartClient()
    {
        base.OnStartClient();

        if (isLocalPlayer)
            return;

        ConfigureRemoteRig();

        Debug.Log(
            "[XR_PRESENCE] Remote Rig Configured | " +
            $"NetID={netId}");
    }

    public override void OnStartServer()
    {
        base.OnStartServer();

        CreateServerBodyContactProxy();
        CreateServerHandContactProxies();
    }

    [ServerCallback]
    private void FixedUpdate()
    {
        bodyContactProxy?.Tick(Time.fixedDeltaTime);
        leftHandContactProxy?.Tick(Time.fixedDeltaTime);
        rightHandContactProxy?.Tick(Time.fixedDeltaTime);
    }

    private void ConfigureLocalRig()
    {
        SetProxyVisibility(false);

        Debug.Log(
            "[XR_PRESENCE] Local Rig: proxies hidden");
    }

    private void ConfigureRemoteRig()
    {
        SetProxyVisibility(true);

        Debug.Log(
            "[XR_PRESENCE] Remote Rig: proxies shown");
    }

    private void SetProxyVisibility(bool visible)
    {
        if (headProxy != null)
            headProxy.SetActive(visible);

        if (leftHandProxy != null)
            leftHandProxy.SetActive(visible);

        if (rightHandProxy != null)
            rightHandProxy.SetActive(visible);
    }

    public override void OnStopClient()
    {
        base.OnStopClient();

        Debug.Log(
            "[XR_PRESENCE] Rig Stopped | " +
            $"NetID={netId}");
    }

    public override void OnStopServer()
    {
        DisposeServerBodyContactProxy();
        DisposeServerHandContactProxies();
        base.OnStopServer();
    }

    [Server]
    private void CreateServerBodyContactProxy()
    {
        GameObject proxyObject = new GameObject("BodyContactProxy");
        float pushStrengthMultiplier = IsRemoteClientParticipant()
            ? RemoteBodyPushStrengthMultiplier
            : 1f;

        bodyContactProxy =
            proxyObject.AddComponent<XRBodyPhysicsContactProxy>();
        bodyContactProxy.Initialize(
            transform,
            transform,
            BodyContactRadius,
            BodyContactHeight,
            BodyContactCenterY,
            pushStrengthMultiplier);
    }

    [Server]
    private void CreateServerHandContactProxies()
    {
        leftHandContactProxy = CreateHandContactProxy(
            leftHandTransform,
            "LeftHandContactProxy");
        rightHandContactProxy = CreateHandContactProxy(
            rightHandTransform,
            "RightHandContactProxy");
    }

    [Server]
    private XRHandPhysicsContactProxy CreateHandContactProxy(
        Transform trackedHandTransform,
        string proxyName)
    {
        if (trackedHandTransform == null)
        {
            return null;
        }

        GameObject proxyObject = new GameObject(proxyName);
        float pushStrengthMultiplier = IsRemoteClientParticipant()
            ? RemoteHandPushStrengthMultiplier
            : 1f;

        XRHandPhysicsContactProxy proxy =
            proxyObject.AddComponent<XRHandPhysicsContactProxy>();
        proxy.Initialize(
            trackedHandTransform,
            transform,
            HandContactRadius,
            pushStrengthMultiplier);

        return proxy;
    }

    [Server]
    private void DisposeServerHandContactProxies()
    {
        DestroyHandContactProxy(ref leftHandContactProxy);
        DestroyHandContactProxy(ref rightHandContactProxy);
    }

    [Server]
    private void DisposeServerBodyContactProxy()
    {
        if (bodyContactProxy == null)
        {
            return;
        }

        Destroy(bodyContactProxy.gameObject);
        bodyContactProxy = null;
    }

    [Server]
    private void DestroyHandContactProxy(
        ref XRHandPhysicsContactProxy proxy)
    {
        if (proxy == null)
        {
            return;
        }

        Destroy(proxy.gameObject);
        proxy = null;
    }

    [Server]
    private bool IsRemoteClientParticipant()
    {
        return connectionToClient != null &&
            connectionToClient.connectionId != NetworkConnection.LocalConnectionId;
    }
}
