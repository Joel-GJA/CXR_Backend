using Mirror;
using UnityEngine;

public class XRParticipantRuntime : NetworkBehaviour
{
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
}
