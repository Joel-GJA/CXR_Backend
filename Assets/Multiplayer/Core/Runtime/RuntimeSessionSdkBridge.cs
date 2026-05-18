using CXR.SDK.Discovery;
using Mirror;
using UnityEngine;

[DisallowMultipleComponent]
public class RuntimeSessionSdkBridge : MonoBehaviour
{
    [SerializeField]
    private RuntimeSessionManager sessionManager;

    [SerializeField]
    private DiscoveryListener discoveryListener;

    [SerializeField]
    private DiscoveryBroadcaster discoveryBroadcaster;

    [Header("Room Advertisement")]
    [SerializeField]
    private string roomName = "XR Runtime Session";

    [SerializeField]
    private int maxParticipants = 16;

    [SerializeField]
    private bool autoCreateSdkComponents = true;

    [SerializeField]
    private bool publishRuntimeMetadata = true;

    private RuntimeSessionManager subscribedManager;

    public string RoomName
    {
        get => roomName;
        set
        {
            EnsureRuntimeComponents();

            roomName = string.IsNullOrWhiteSpace(value)
                ? "XR Runtime Session"
                : value;

            ApplyStaticAdvertisement();
            PublishSessionAdvertisement();
        }
    }

    public int MaxParticipants
    {
        get => maxParticipants;
        set
        {
            EnsureRuntimeComponents();

            maxParticipants = Mathf.Max(1, value);
            ApplyStaticAdvertisement();
            PublishSessionAdvertisement();
        }
    }

    private void Awake()
    {
        EnsureRuntimeComponents();
        ApplyStaticAdvertisement();
        PublishSessionAdvertisement();
    }

    private void OnEnable()
    {
        EnsureRuntimeComponents();
        Subscribe();
        PublishSessionAdvertisement();
    }

    private void OnDisable()
    {
        Unsubscribe();
    }

    private void Update()
    {
        PublishSessionAdvertisement();
    }

    public void InitializeForRuntime()
    {
        EnsureRuntimeComponents();
        ApplyStaticAdvertisement();
        Subscribe();
        PublishSessionAdvertisement();
    }

    public void PublishSessionAdvertisement()
    {
        if (discoveryBroadcaster == null || sessionManager == null)
        {
            return;
        }

        discoveryBroadcaster.SetPlayerCountOverride(
            sessionManager.ParticipantCount);

        discoveryBroadcaster.Status =
            ResolveRoomStatus(sessionManager.State);

        if (!publishRuntimeMetadata)
        {
            return;
        }

        discoveryBroadcaster.SetMetadata(
            "runtimeSessionState",
            sessionManager.State.ToString());

        discoveryBroadcaster.SetMetadata(
            "runtimeParticipantCount",
            sessionManager.ParticipantCount.ToString());

        discoveryBroadcaster.SetMetadata(
            "runtimeTrackedParticipantCount",
            sessionManager.ParticipantInfos.Count.ToString());

        discoveryBroadcaster.SetMetadata(
            "runtimeServerActive",
            NetworkServer.active.ToString());
    }

    private void EnsureRuntimeComponents()
    {
        if (sessionManager == null)
        {
            sessionManager =
                RuntimeSessionManager.Instance ??
                GetComponent<RuntimeSessionManager>();
        }

        if (sessionManager == null && autoCreateSdkComponents)
        {
            sessionManager =
                gameObject.AddComponent<RuntimeSessionManager>();
        }

        if (discoveryListener == null)
        {
            discoveryListener = GetComponent<DiscoveryListener>();
        }

        if (discoveryListener == null && autoCreateSdkComponents)
        {
            discoveryListener =
                gameObject.AddComponent<DiscoveryListener>();
        }

        if (discoveryBroadcaster == null)
        {
            discoveryBroadcaster = GetComponent<DiscoveryBroadcaster>();
        }

        if (discoveryBroadcaster == null && autoCreateSdkComponents)
        {
            discoveryBroadcaster =
                gameObject.AddComponent<DiscoveryBroadcaster>();
        }

        if (discoveryListener != null && discoveryBroadcaster != null)
        {
            discoveryListener.SetBroadcaster(discoveryBroadcaster);
        }
    }

    private void ApplyStaticAdvertisement()
    {
        if (discoveryBroadcaster == null)
        {
            return;
        }

        discoveryBroadcaster.RoomName = roomName;
        discoveryBroadcaster.MaxPlayers = maxParticipants;
        discoveryBroadcaster.SetMetadata(
            "runtimeLayer",
            "RuntimeSessionManager");
    }

    private void Subscribe()
    {
        if (sessionManager == null || subscribedManager == sessionManager)
        {
            return;
        }

        Unsubscribe();

        subscribedManager = sessionManager;
        subscribedManager.StateChanged += OnSessionStateChanged;
        subscribedManager.ParticipantRegistered += OnParticipantChanged;
        subscribedManager.ParticipantUnregistered += OnParticipantChanged;
    }

    private void Unsubscribe()
    {
        if (subscribedManager == null)
        {
            return;
        }

        subscribedManager.StateChanged -= OnSessionStateChanged;
        subscribedManager.ParticipantRegistered -= OnParticipantChanged;
        subscribedManager.ParticipantUnregistered -= OnParticipantChanged;
        subscribedManager = null;
    }

    private void OnSessionStateChanged(
        RuntimeSessionState previousState,
        RuntimeSessionState nextState)
    {
        PublishSessionAdvertisement();
    }

    private void OnParticipantChanged(RuntimeParticipant participant)
    {
        PublishSessionAdvertisement();
    }

    private string ResolveRoomStatus(RuntimeSessionState state)
    {
        return state switch
        {
            RuntimeSessionState.WaitingForParticipants => "Open",
            RuntimeSessionState.Initializing => "Initializing",
            RuntimeSessionState.Active => "Active",
            RuntimeSessionState.ShuttingDown => "ShuttingDown",
            _ => "Unknown"
        };
    }
}
