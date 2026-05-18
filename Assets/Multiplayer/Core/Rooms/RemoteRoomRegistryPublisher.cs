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
    private float publishIntervalSeconds = 5f;

    [SerializeField]
    private DiscoveryBroadcaster discoveryBroadcaster;

    private Coroutine publishLoop;

    public string RegistryUrl
    {
        get => registryUrl;
        set => registryUrl = value ?? string.Empty;
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
        publishLoop = StartCoroutine(PublishLoop());
    }

    private void OnDisable()
    {
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

        StartCoroutine(PublishOnce());
    }

    private IEnumerator PublishLoop()
    {
        while (enabled)
        {
            yield return PublishOnce();

            yield return new WaitForSecondsRealtime(
                Mathf.Max(1f, publishIntervalSeconds));
        }
    }

    private IEnumerator PublishOnce()
    {
        if (!HasRegistry)
        {
            yield break;
        }

        if (publishOnlyWhenServerActive && !NetworkServer.active)
        {
            yield break;
        }

        ResolveReferences();

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

        using UnityWebRequest request = new UnityWebRequest(
            BuildRoomsUrl(),
            UnityWebRequest.kHttpVerbPOST);

        request.uploadHandler = new UploadHandlerRaw(body);
        request.downloadHandler = new DownloadHandlerBuffer();
        request.SetRequestHeader("Content-Type", "application/json");
        request.timeout = 5;

        yield return request.SendWebRequest();

        if (request.result != UnityWebRequest.Result.Success)
        {
            Debug.LogWarning(
                "[REMOTE ROOM REGISTRY] Publish failed: " +
                request.error);
        }
    }

    private void ResolveReferences()
    {
        if (discoveryBroadcaster == null)
        {
            discoveryBroadcaster = GetComponent<DiscoveryBroadcaster>();
        }
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
        return registryUrl.TrimEnd('/') + "/rooms";
    }
}
