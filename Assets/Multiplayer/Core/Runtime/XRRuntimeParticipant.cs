using UnityEngine;

public class XRRuntimeParticipant : RuntimeParticipant
{
    [Header("XR Tracking Anchors")]
    [SerializeField]
    private Transform headRoot;

    [SerializeField]
    private Transform leftHandRoot;

    [SerializeField]
    private Transform rightHandRoot;

    public Transform HeadRoot => headRoot;

    public Transform LeftHandRoot => leftHandRoot;

    public Transform RightHandRoot => rightHandRoot;

    protected override void Awake()
    {
        base.Awake();
        ResolveXRAnchors(true);
    }

    protected override void Reset()
    {
        base.Reset();
        ResolveXRAnchors(false);
    }

    protected override void OnValidate()
    {
        base.OnValidate();
        ResolveXRAnchors(false);
    }

    private void ResolveXRAnchors(bool createMissing)
    {
        headRoot = ResolveAnchor(
            headRoot,
            "HeadRoot",
            "",
            createMissing);
        leftHandRoot = ResolveAnchor(
            leftHandRoot,
            "LeftHandRoot",
            "",
            createMissing);
        rightHandRoot = ResolveAnchor(
            rightHandRoot,
            "RightHandRoot",
            "",
            createMissing);
    }
}
