using System;
using System.Collections;
using System.Collections.Generic;
using CXR.SDK.Networking;
using CXR.SDK.Rooms;
using UnityEngine;
using UnityEngine.Networking;

[AddComponentMenu("CXR Multiplayer/Remote Room Registry Browser")]
[DisallowMultipleComponent]
public sealed class RemoteRoomRegistryBrowser : MonoBehaviour
{
    [SerializeField]
    private string registryUrl = string.Empty;

    [SerializeField]
    private bool configureFromEnvironmentOrCommandLine = true;

    [SerializeField]
    private JoinRoomHandler joinRoomHandler;

    private readonly List<RoomInfo> visibleRooms = new List<RoomInfo>();

    public event Action<IReadOnlyList<RoomInfo>> RoomsChanged;

    public event Action<string> RefreshFailed;

    public IReadOnlyList<RoomInfo> VisibleRooms => visibleRooms;

    public string LastError { get; private set; } = string.Empty;

    public long LastResponseCode { get; private set; } = -1;

    public int LastResponseBytes { get; private set; }

    public float LastRefreshTime { get; private set; } = -1f;

    public string RegistryUrl
    {
        get => registryUrl;
        set => registryUrl = NormalizeRegistryUrl(value);
    }

    public bool HasRegistry =>
        !string.IsNullOrWhiteSpace(registryUrl);

    private void Awake()
    {
        if (configureFromEnvironmentOrCommandLine)
        {
            ConfigureRegistryUrl();
        }

        ResolveReferences();
    }

    public void RefreshRooms()
    {
        if (!isActiveAndEnabled)
        {
            return;
        }

        StartCoroutine(RefreshRoomsRoutine());
    }

    public bool JoinRoom(string roomId, out string error)
    {
        error = string.Empty;
        ResolveReferences();

        RoomInfo room = GetRoomById(roomId);
        if (room == null)
        {
            error = "Selected remote room was not found.";
            return false;
        }

        if (joinRoomHandler == null)
        {
            error = "JoinRoomHandler is unavailable.";
            return false;
        }

        return joinRoomHandler.TryJoin(room, out error);
    }

    public RoomInfo GetRoomById(string roomId)
    {
        if (string.IsNullOrWhiteSpace(roomId))
        {
            return null;
        }

        for (int index = 0; index < visibleRooms.Count; index++)
        {
            if (visibleRooms[index] != null &&
                string.Equals(
                    visibleRooms[index].RoomId,
                    roomId,
                    StringComparison.OrdinalIgnoreCase))
            {
                return visibleRooms[index];
            }
        }

        return null;
    }

    private IEnumerator RefreshRoomsRoutine()
    {
        LastError = string.Empty;

        if (!HasRegistry)
        {
            LastError = "Remote room registry URL is not configured.";
            RefreshFailed?.Invoke(LastError);
            yield break;
        }

        string roomsUrl = BuildRoomsUrl();
        if (string.IsNullOrWhiteSpace(roomsUrl))
        {
            LastError = "Remote room registry URL is invalid.";
            RefreshFailed?.Invoke(LastError);
            yield break;
        }

        using UnityWebRequest request = UnityWebRequest.Get(roomsUrl);
        request.timeout = 5;
        LastRefreshTime = Time.unscaledTime;

        Debug.Log("[REMOTE ROOM REGISTRY] Refreshing rooms from " + roomsUrl);

        UnityWebRequestAsyncOperation operation;
        try
        {
            operation = request.SendWebRequest();
        }
        catch (InvalidOperationException exception)
        {
            LastError =
                $"Remote registry request failed for {roomsUrl}: " +
                exception.Message;

            Debug.LogWarning("[REMOTE ROOM REGISTRY] " + LastError);
            RefreshFailed?.Invoke(LastError);
            yield break;
        }

        yield return operation;

        LastResponseCode = request.responseCode;
        LastResponseBytes = request.downloadHandler != null &&
            request.downloadHandler.data != null
                ? request.downloadHandler.data.Length
                : 0;

        if (request.result != UnityWebRequest.Result.Success)
        {
            LastError =
                $"Remote registry request failed for {roomsUrl}: " +
                request.error +
                $" (HTTP {LastResponseCode})";

            Debug.LogWarning("[REMOTE ROOM REGISTRY] " + LastError);
            RefreshFailed?.Invoke(LastError);
            yield break;
        }

        Debug.Log(
            "[REMOTE ROOM REGISTRY] Response HTTP " +
            LastResponseCode +
            " with " +
            LastResponseBytes +
            " bytes from " +
            roomsUrl);

        RemoteRoomRegistryEnvelope envelope =
            JsonUtility.FromJson<RemoteRoomRegistryEnvelope>(
                request.downloadHandler.text);

        visibleRooms.Clear();

        if (envelope != null && envelope.rooms != null)
        {
            for (int index = 0; index < envelope.rooms.Length; index++)
            {
                if (envelope.rooms[index] != null)
                {
                    visibleRooms.Add(envelope.rooms[index].ToRoomInfo());
                }
            }
        }

        Debug.Log(
            "[REMOTE ROOM REGISTRY] Refreshed " +
            visibleRooms.Count +
            " rooms from " +
            roomsUrl);

        if (visibleRooms.Count == 0)
        {
            Debug.Log(
                "[REMOTE ROOM REGISTRY] Registry returned no rooms. Body: " +
                BuildPreview(request.downloadHandler.text));
        }

        RoomsChanged?.Invoke(visibleRooms);
    }

    private void ResolveReferences()
    {
        if (joinRoomHandler == null)
        {
            joinRoomHandler = GetComponent<JoinRoomHandler>();
        }

        if (joinRoomHandler == null)
        {
            joinRoomHandler = FindObjectOfType<JoinRoomHandler>();
        }
    }

    private string BuildRoomsUrl()
    {
        string normalizedUrl = NormalizeRegistryUrl(registryUrl);
        if (!IsSupportedHttpUrl(normalizedUrl))
        {
            return string.Empty;
        }

        return normalizedUrl.TrimEnd('/') + "/rooms";
    }

    private void ConfigureRegistryUrl()
    {
        string configuredUrl =
            Environment.GetEnvironmentVariable("CXR_REGISTRY_URL");
        if (string.IsNullOrWhiteSpace(configuredUrl))
        {
            configuredUrl = ReadRegistryUrlFromCommandLine(
                Environment.GetCommandLineArgs());
        }

        if (!string.IsNullOrWhiteSpace(configuredUrl))
        {
            RegistryUrl = configuredUrl;
        }
    }

    public static string NormalizeRegistryUrl(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        string trimmed = value.Trim();
        if (!trimmed.Contains("://"))
        {
            trimmed = "http://" + trimmed;
        }

        return trimmed.TrimEnd('/');
    }

    private static bool IsSupportedHttpUrl(string value)
    {
        if (!Uri.TryCreate(value, UriKind.Absolute, out Uri uri))
        {
            return false;
        }

        return uri.Scheme == Uri.UriSchemeHttp ||
            uri.Scheme == Uri.UriSchemeHttps;
    }

    private static string BuildPreview(string value)
    {
        if (string.IsNullOrEmpty(value))
        {
            return "<empty>";
        }

        return value.Length <= 256 ? value : value.Substring(0, 256);
    }

    private static string ReadRegistryUrlFromCommandLine(string[] args)
    {
        if (args == null)
        {
            return string.Empty;
        }

        for (int index = 0; index < args.Length; index++)
        {
            string arg = args[index];
            if (string.IsNullOrWhiteSpace(arg))
            {
                continue;
            }

            const string inlinePrefix = "--registry-url=";
            if (arg.StartsWith(
                    inlinePrefix,
                    StringComparison.OrdinalIgnoreCase))
            {
                return arg.Substring(inlinePrefix.Length);
            }

            if (string.Equals(
                    arg,
                    "--registry-url",
                    StringComparison.OrdinalIgnoreCase) ||
                string.Equals(
                    arg,
                    "-registryUrl",
                    StringComparison.OrdinalIgnoreCase))
            {
                int valueIndex = index + 1;
                return valueIndex < args.Length
                    ? args[valueIndex]
                    : string.Empty;
            }
        }

        return string.Empty;
    }
}
