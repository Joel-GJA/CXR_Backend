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
    private DiscoveryBroadcaster discoveryBroadcaster;

    [SerializeField]
    private RuntimeSessionManager sessionManager;

    private Coroutine publishLoop;
    private bool publishRequested = true;
    private bool lastServerActive;
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

    public void Initialize(DiscoveryBroadcaster broadcaster)
    {
        discoveryBroadcaster = broadcaster;
    }

    private void Awake()
    {
        ResolveSessionManager();
    }

    private void OnEnable()
    {
        ResolveSessionManager();
        SubscribeSessionEvents();
        MarkPublishRequested();
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

        MarkPublishRequested();
        StartCoroutine(PublishOnce());
    }

    private IEnumerator PublishLoop()
    {
        while (enabled)
        {
            bool serverActive = NetworkServer.active;
            if (serverActive != lastServerActive)
            {
                lastServerActive = serverActive;
                MarkPublishRequested();
            }

            if (serverActive && Time.unscaledTime >= nextSafetyHeartbeatTime)
            {
                MarkPublishRequested();
            }

            if (publishRequested && Time.unscaledTime >= nextRetryTime)
            {
                yield return PublishOnce();
            }

            yield return new WaitForSecondsRealtime(
                Mathf.Max(0.25f, publishCheckIntervalSeconds));
        }
    }

    private IEnumerator PublishOnce()
    {
        if (!HasRegistry)
        {
            publishRequested = false;
            yield break;
        }

        if (publishOnlyWhenServerActive && !NetworkServer.active)
        {
            yield break;
        }

        ResolveSessionManager();

        if (discoveryBroadcaster == null ||
            !discoveryBroadcaster.TryBuildResponse(out var response))
        {
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
            ScheduleRetry();
            yield break;
        }

        yield return operation;

        if (request.result != UnityWebRequest.Result.Success)
        {
            Debug.LogWarning(
                "[REMOTE ROOM REGISTRY] Publish failed: " +
                request.error);
            ScheduleRetry();
            yield break;
        }

        publishRequested = false;
        nextSafetyHeartbeatTime =
            Time.unscaledTime + Mathf.Max(5f, safetyHeartbeatSeconds);
    }

    private void ResolveSessionManager()
    {
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
    }

    private void ScheduleRetry()
    {
        publishRequested = true;
        nextRetryTime = Time.unscaledTime +
            Mathf.Max(1f, publishCheckIntervalSeconds);
    }

    private string ResolvePublicAddress(string fallback)
    {
        return !string.IsNullOrWhiteSpace(publicAddress)
            ? publicAddress.Trim()
            : fallback;
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
