using Mirror;
using UnityEngine;

public class RuntimeParticipant : RuntimeEntity
{
    [Header("Extension Anchors")]
    [SerializeField]
    private Transform headRoot;

    [SerializeField]
    private Transform leftHandRoot;

    [SerializeField]
    private Transform rightHandRoot;

    [SerializeField]
    private Transform rigMount;

    [SerializeField]
    private Transform avatarVisualRoot;

    public Transform HeadRoot => headRoot;

    public Transform LeftHandRoot => leftHandRoot;

    public Transform RightHandRoot => rightHandRoot;

    public Transform RigMount => rigMount;

    public Transform AvatarVisualRoot => avatarVisualRoot;

    protected virtual void Awake()
    {
        ResolveAnchors(true);
    }

    public override void Initialize(uint ownerId)
    {
        base.Initialize(ownerId);

        Debug.Log($"[PARTICIPANT] Initialized | NetID={netId}");
    }

    public override void OnStartServer()
    {
        base.OnStartServer();

        RuntimeSessionManager sessionManager =
            RuntimeSessionManager.Instance ??
            FindObjectOfType<RuntimeSessionManager>();

        if (sessionManager != null)
        {
            sessionManager.RegisterParticipant(this);
        }
        else
        {
            Debug.LogWarning(
                $"[PARTICIPANT] RuntimeSessionManager Not Found | " +
                $"NetID={netId}");
        }
    }

    public override void OnStopServer()
    {
        RuntimeSessionManager sessionManager =
            RuntimeSessionManager.Instance ??
            FindObjectOfType<RuntimeSessionManager>();

        if (sessionManager != null)
        {
            sessionManager.HandleParticipantDisconnect(this);
        }

        base.OnStopServer();
    }

    public override void OnStartLocalPlayer()
    {
        base.OnStartLocalPlayer();

        Debug.Log($"[RUNTIME] Local Participant Started | NetID={netId}");
    }

    public override void OnStopLocalPlayer()
    {
        base.OnStopLocalPlayer();

        Debug.Log($"[RUNTIME] Local Participant Stopped | NetID={netId}");
    }

    public override void OnStopClient()
    {
        base.OnStopClient();

        Debug.Log($"[RUNTIME] Participant Removed | NetID={netId}");
    }

    protected virtual void Reset()
    {
        ResolveAnchors(false);
    }

    protected override void OnValidate()
    {
        base.OnValidate();
        ResolveAnchors(false);
    }

    private void ResolveAnchors(bool createMissing)
    {
        headRoot = ResolveAnchor(headRoot, "HeadRoot", "", createMissing);
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
        rigMount = ResolveAnchor(
            rigMount,
            "RigMount",
            "RigMountPoint",
            createMissing);
        avatarVisualRoot = ResolveAnchor(
            avatarVisualRoot,
            "AvatarVisualRoot",
            "Visual",
            createMissing);
    }

    private Transform ResolveAnchor(
        Transform current,
        string primaryName,
        string fallbackName,
        bool createMissing)
    {
        if (current != null)
        {
            return current;
        }

        Transform found = transform.Find(primaryName);
        if (found != null)
        {
            return found;
        }

        if (!string.IsNullOrWhiteSpace(fallbackName))
        {
            found = transform.Find(fallbackName);
            if (found != null)
            {
                return found;
            }
        }

        if (!createMissing)
        {
            return null;
        }

        GameObject anchor = new GameObject(primaryName);
        anchor.transform.SetParent(transform, false);
        return anchor.transform;
    }
}
