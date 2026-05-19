using System.Collections;
using CXR.SDK.Discovery;
using CXR.SDK.Rooms;
using Mirror;
using UnityEngine;
using UnityEngine.Networking;

[AddComponentMenu("CXR Multiplayer/Remote Room Registry Publisher")]
[DisallowMultipleComponent]
public sealed class RemoteRoomRegistryPublisher : MonoBehaviour
{
    [SerializeField]
    private string registryUrl = string.Empty;

    [SerializeField]
    private string publicAddress = string.Empty;

    [SerializeField]
    private int publicPort = 7777;

    [SerializeField]
    private bool publishOnlyWhenServerActive = true;

    [SerializeField]
    private float publishCheckIntervalSeconds = 1f;

    [SerializeField]
    private float safetyHeartbeatSeconds = 30f;

    [SerializeField]
    [Tooltip("Delay between retry attempts after a failed publish.")]
    private float publishRetryIntervalSeconds = 5f;

    [SerializeField]
    [Tooltip("Maximum consecutive publish retries before giving up (0 = infinite).")]
    private int maxPublishRetries = 3;

    [SerializeField]
    private DiscoveryBroadcaster discoveryBroadcaster;

    [SerializeField]
    private RuntimeSessionManager sessionManager;

    private Coroutine publishLoop;
    private bool publishRequested = true;
    private bool isPublishing;
    private bool publishQueued;
    private int publishRetryCount;
    private float nextSafetyHeartbeatTime;
    private float nextRetryTime;
    private RuntimeSessionManager subscribedSessionManager;

    public string RegistryUrl
    {
        get => registryUrl;
        set => registryUrl = RemoteRoomRegistryBrowser.NormalizeRegistryUrl(value);
    }

    public string PublicAddress
    {
        get => publicAddress;
        set => publicAddress = value ?? string.Empty;
    }

    public int PublicPort
    {
        get => publicPort;
        set => publicPort = Mathf.Max(1, value);
    }

    public bool HasRegistry =>
        !string.IsNullOrWhiteSpace(registryUrl);

    private void Awake()
    {
        ResolveReferences();
    }

    private void OnEnable()
    {
        ResolveReferences();
        SubscribeSessionEvents();
        MarkPublishRequested();
        nextSafetyHeartbeatTime =
            Time.unscaledTime + Mathf.Max(5f, safetyHeartbeatSeconds);
        publishLoop = StartCoroutine(PublishLoop());
    }

    private void OnDisable()
    {
        UnsubscribeSessionEvents();

        if (publishLoop != null)
        {
            StopCoroutine(publishLoop);
            publishLoop = null;
        }
    }

    public void PublishNow()
    {
        if (!isActiveAndEnabled)
        {
            return;
        }

        if (isPublishing)
        {
            publishQueued = true;
            MarkPublishRequested();
            return;
        }

        MarkPublishRequested();
        StartCoroutine(PublishOnce());
    }

    private IEnumerator PublishLoop()
    {
        while (enabled)
        {
            if (NetworkServer.active && Time.unscaledTime >= nextSafetyHeartbeatTime)
            {
                MarkPublishRequested();
            }

            if (publishRequested && Time.unscaledTime >= nextRetryTime && !isPublishing)
            {
                yield return PublishOnce();
            }

            yield return new WaitForSecondsRealtime(
                Mathf.Max(0.25f, publishCheckIntervalSeconds));
        }
    }

    private IEnumerator PublishOnce()
    {
        if (isPublishing)
        {
            Debug.Log("[REMOTE ROOM REGISTRY] Publish skipped: already publishing.");
            yield break;
        }

        isPublishing = true;

        if (!HasRegistry)
        {
            Debug.LogWarning(
                "[REMOTE ROOM REGISTRY] Publish skipped: no registry URL configured. " +
                "Set CXR_REGISTRY_URL env var or --registry-url command line arg.");
            publishRequested = false;
            isPublishing = false;
            yield break;
        }

        if (publishOnlyWhenServerActive && !NetworkServer.active)
        {
            publishRetryCount++;
            if (maxPublishRetries > 0 && publishRetryCount >= maxPublishRetries)
            {
                Debug.LogWarning(
                    "[REMOTE ROOM REGISTRY] Publish abandoned after " +
                    maxPublishRetries +
                    " retries: server not active. Click 'Advertise Room' to retry.");
                publishRequested = false;
                isPublishing = false;
                yield break;
            }

            Debug.Log(
                "[REMOTE ROOM REGISTRY] Publish deferred: server not active yet. " +
                "Will retry via PublishLoop.");
            isPublishing = false;
            yield break;
        }

        ResolveReferences();

        if (discoveryBroadcaster == null)
        {
            Debug.LogWarning(
                "[REMOTE ROOM REGISTRY] Publish skipped: DiscoveryBroadcaster not found. " +
                "Ensure a DiscoveryBroadcaster component exists in the scene.");
            isPublishing = false;
            yield break;
        }

        if (!discoveryBroadcaster.TryBuildResponse(out var response))
        {
            Debug.LogWarning(
                "[REMOTE ROOM REGISTRY] Publish skipped: DiscoveryBroadcaster.TryBuildResponse " +
                "returned false. Likely requireServerActive=true and server not active, " +
                "or port could not be resolved (set explicitPort on DiscoveryBroadcaster).");
            isPublishing = false;
            yield break;
        }

        RoomInfo room = new RoomInfo
        {
            RoomId = response.RoomId,
            RoomName = response.RoomName,
            PlayerCount = response.PlayerCount,
            MaxPlayers = response.MaxPlayers,
            Status = response.Status,
            IpAddress = ResolvePublicAddress(response.IpAddress),
            Port = ResolvePublicPort(response.Port)
        };

        room.ReplaceMetadata(response.Metadata);

        RemoteRoomRecord record = RemoteRoomRecord.FromRoomInfo(room);
        string json = JsonUtility.ToJson(record);
        byte[] body = System.Text.Encoding.UTF8.GetBytes(json);

        string roomsUrl = BuildRoomsUrl();
        if (string.IsNullOrWhiteSpace(roomsUrl))
        {
            Debug.LogWarning(
                "[REMOTE ROOM REGISTRY] Publish skipped: registry URL is invalid.");
            isPublishing = false;
            yield break;
        }

        using UnityWebRequest request = new UnityWebRequest(
            roomsUrl,
            UnityWebRequest.kHttpVerbPOST);

        request.uploadHandler = new UploadHandlerRaw(body);
        request.downloadHandler = new DownloadHandlerBuffer();
        request.SetRequestHeader("Content-Type", "application/json");
        request.timeout = 5;

        UnityWebRequestAsyncOperation operation;
        try
        {
            operation = request.SendWebRequest();
        }
        catch (System.InvalidOperationException exception)
        {
            Debug.LogWarning(
                "[REMOTE ROOM REGISTRY] Publish failed: " +
                exception.Message);
            isPublishing = false;
            publishQueued = false;
            ScheduleRetry();
            yield break;
        }

        yield return operation;

        if (request.result != UnityWebRequest.Result.Success)
        {
            Debug.LogWarning(
                "[REMOTE ROOM REGISTRY] Publish failed: " +
                request.error);
            isPublishing = false;
            publishQueued = false;
            ScheduleRetry();
            yield break;
        }

        publishRequested = false;
        isPublishing = false;
        publishRetryCount = 0;

        if (publishQueued)
        {
            publishQueued = false;
            MarkPublishRequested();
        }

        nextSafetyHeartbeatTime =
            Time.unscaledTime + Mathf.Max(5f, safetyHeartbeatSeconds);
    }

    private void ResolveReferences()
    {
        if (discoveryBroadcaster == null)
        {
            discoveryBroadcaster = GetComponent<DiscoveryBroadcaster>();
        }

        if (sessionManager == null)
        {
            sessionManager = GetComponent<RuntimeSessionManager>();
        }

        if (sessionManager == null)
        {
            sessionManager = FindObjectOfType<RuntimeSessionManager>();
        }

        SubscribeSessionEvents();
    }

    private void SubscribeSessionEvents()
    {
        if (sessionManager == subscribedSessionManager)
        {
            return;
        }

        UnsubscribeSessionEvents();

        if (sessionManager == null)
        {
            return;
        }

        sessionManager.StateChanged += OnSessionStateChanged;
        sessionManager.ParticipantRegistered += OnParticipantChanged;
        sessionManager.ParticipantUnregistered += OnParticipantChanged;
        subscribedSessionManager = sessionManager;
    }

    private void UnsubscribeSessionEvents()
    {
        if (subscribedSessionManager == null)
        {
            return;
        }

        subscribedSessionManager.StateChanged -= OnSessionStateChanged;
        subscribedSessionManager.ParticipantRegistered -= OnParticipantChanged;
        subscribedSessionManager.ParticipantUnregistered -= OnParticipantChanged;
        subscribedSessionManager = null;
    }

    private void OnSessionStateChanged(
        RuntimeSessionState previousState,
        RuntimeSessionState nextState)
    {
        MarkPublishRequested();
    }

    private void OnParticipantChanged(RuntimeParticipant participant)
    {
        MarkPublishRequested();
    }

    private void MarkPublishRequested()
    {
        publishRequested = true;
        nextRetryTime = 0f;
        publishRetryCount = 0;
    }

    private void ScheduleRetry()
    {
        publishRequested = true;
        nextRetryTime = Time.unscaledTime +
            Mathf.Max(1f, publishRetryIntervalSeconds);
    }

    private string ResolvePublicAddress(string fallback)
    {
        if (!string.IsNullOrWhiteSpace(publicAddress))
        {
            return publicAddress.Trim();
        }

        if (!string.IsNullOrWhiteSpace(fallback))
        {
            return fallback;
        }

        RemoteRoomRegistryBrowser.TryResolveLanAddress(out string lanAddress);
        return lanAddress;
    }

    private int ResolvePublicPort(int fallback)
    {
        return publicPort > 0 ? publicPort : fallback;
    }

    private string BuildRoomsUrl()
    {
        string normalizedUrl =
            RemoteRoomRegistryBrowser.NormalizeRegistryUrl(registryUrl);

        if (!System.Uri.TryCreate(
                normalizedUrl,
                System.UriKind.Absolute,
                out System.Uri uri) ||
            (uri.Scheme != System.Uri.UriSchemeHttp &&
                uri.Scheme != System.Uri.UriSchemeHttps))
        {
            return string.Empty;
        }

        return normalizedUrl.TrimEnd('/') + "/rooms";
    }
}
