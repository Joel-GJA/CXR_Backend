using System.Collections.Generic;
using CXR.SDK.Rooms;
using Mirror;
using UnityEngine;

[DisallowMultipleComponent]
public sealed class XRMultiplayerDebugGUI : MonoBehaviour
{
    [SerializeField]
    private XRMultiplayerRuntimeFacade runtimeFacade;

    [SerializeField]
    private bool autoCreateFacade = true;

    [SerializeField]
    private bool visible = true;

    [SerializeField]
    private KeyCode toggleKey = KeyCode.F1;

    [SerializeField]
    private Rect windowRect = new Rect(12f, 12f, 420f, 620f);

    [SerializeField]
    private int maxVisibleRooms = 8;

    [SerializeField]
    private string directConnectAddress = "localhost";

    [SerializeField]
    private string remoteRegistryUrl = string.Empty;

    private Vector2 scrollPosition;

    private void Awake()
    {
        ResolveReferences();
    }

    private void Update()
    {
        if (Input.GetKeyDown(toggleKey))
        {
            visible = !visible;
        }

        ResolveReferences();
    }

    private void OnGUI()
    {
        if (!visible)
        {
            return;
        }

        windowRect = GUILayout.Window(
            GetInstanceID(),
            windowRect,
            DrawWindow,
            "XR Multiplayer Debug");
    }

    private void DrawWindow(int windowId)
    {
        DrawNetworkLifecycle();
        GUILayout.Space(8f);
        DrawDiscoveryLifecycle();
        GUILayout.Space(8f);
        DrawRemoteRegistry();
        GUILayout.Space(8f);
        DrawSessionSnapshot();
        GUILayout.Space(8f);
        DrawRoomBrowser();

        GUI.DragWindow(new Rect(0f, 0f, 10000f, 24f));
    }

    private void DrawNetworkLifecycle()
    {
        GUILayout.Label("Connection");
        GUILayout.Label("Mode: " + ResolveModeLabel());
        GUILayout.Label("Address: " + ResolveAddress());
        directConnectAddress = GUILayout.TextField(directConnectAddress);

        GUILayout.BeginHorizontal();
        if (GUILayout.Button("Host"))
        {
            runtimeFacade?.StartHost();
        }

        if (GUILayout.Button("Server"))
        {
            runtimeFacade?.StartServer();
        }

        if (GUILayout.Button("Client"))
        {
            runtimeFacade?.StartClient(directConnectAddress);
        }
        GUILayout.EndHorizontal();

        GUILayout.BeginHorizontal();
        if (GUILayout.Button("Stop Client"))
        {
            runtimeFacade?.StopClient();
        }

        if (GUILayout.Button("Stop Host/Server"))
        {
            runtimeFacade?.Stop();
        }
        GUILayout.EndHorizontal();
    }

    private void DrawDiscoveryLifecycle()
    {
        GUILayout.Label("Discovery");

        if (runtimeFacade == null || !runtimeFacade.IsDiscoveryAvailable)
        {
            GUILayout.Label("Lifecycle: missing");
            if (GUILayout.Button("Resolve Lifecycle"))
            {
                ResolveReferences();
            }

            return;
        }

        XRRoomBrowserModel browser = runtimeFacade.RoomBrowser;
        GUILayout.Label("State: " + browser.DiscoveryState);
        GUILayout.Label("Rooms: " + browser.VisibleRoomCount);
        GUILayout.Label("Last Refresh: " + FormatTime(browser.LastRefreshTime));

        if (!string.IsNullOrWhiteSpace(browser.LastError))
        {
            GUILayout.Label("Error: " + browser.LastError);
        }

        GUILayout.BeginHorizontal();
        if (GUILayout.Button("Start"))
        {
            runtimeFacade.StartDiscovery();
        }

        if (GUILayout.Button("Refresh"))
        {
            runtimeFacade.RefreshRooms();
        }

        if (GUILayout.Button("Stop"))
        {
            runtimeFacade.StopDiscovery();
        }
        GUILayout.EndHorizontal();
    }

    private void DrawSessionSnapshot()
    {
        GUILayout.Label("Session");

        if (runtimeFacade == null)
        {
            GUILayout.Label("Runtime facade: missing");
            return;
        }

        GUILayout.Label("State: " + runtimeFacade.SessionState);
        GUILayout.Label("Participants: " + runtimeFacade.ParticipantCount);
        GUILayout.Label("Tracked Participants: " + runtimeFacade.TrackedParticipantCount);
        GUILayout.Label("Connected Clients: " + runtimeFacade.ConnectedClientCount);
        GUILayout.Label("Local Player NetID: " + runtimeFacade.LocalPlayerNetId);
        GUILayout.Label("Connection ID: " + runtimeFacade.LocalConnectionId);
    }

    private void DrawRemoteRegistry()
    {
        GUILayout.Label("Remote Registry");

        if (runtimeFacade == null)
        {
            GUILayout.Label("Runtime facade: missing");
            return;
        }

        if (string.IsNullOrWhiteSpace(remoteRegistryUrl))
        {
            remoteRegistryUrl = runtimeFacade.RemoteRegistryUrl;
        }

        GUILayout.Label("URL");
        remoteRegistryUrl = GUILayout.TextField(remoteRegistryUrl);

        GUILayout.Label(
            "Configured: " +
            (runtimeFacade.IsRemoteRegistryAvailable ? "yes" : "no"));
        GUILayout.Label("Remote Rooms: " + runtimeFacade.RemoteRoomCount);
        GUILayout.Label(
            "Last Refresh: " +
            FormatTime(runtimeFacade.RemoteRegistryLastRefreshTime));
        GUILayout.Label(
            "Last HTTP: " +
            FormatHttpStatus(
                runtimeFacade.RemoteRegistryLastResponseCode,
                runtimeFacade.RemoteRegistryLastResponseBytes));

        if (!string.IsNullOrWhiteSpace(
                runtimeFacade.RemoteRegistryLastError))
        {
            GUILayout.Label(
                "Error: " + runtimeFacade.RemoteRegistryLastError);
        }

        GUILayout.BeginHorizontal();
        if (GUILayout.Button("Apply URL"))
        {
            runtimeFacade.RemoteRegistryUrl = remoteRegistryUrl;
        }

        if (GUILayout.Button("Refresh Registry"))
        {
            runtimeFacade.RemoteRegistryUrl = remoteRegistryUrl;
            runtimeFacade.RefreshRemoteRooms();
        }
        GUILayout.EndHorizontal();

        if (GUILayout.Button("Advertise Room"))
        {
            runtimeFacade.RemoteRegistryUrl = remoteRegistryUrl;
            runtimeFacade.PublishRoomToRegistry();
        }
    }

    private void DrawRoomBrowser()
    {
        GUILayout.Label("Rooms");

        if (runtimeFacade == null)
        {
            return;
        }

        IReadOnlyList<RoomInfo> rooms = runtimeFacade.VisibleRooms;
        if (rooms.Count == 0)
        {
            GUILayout.Label("No rooms visible.");
            return;
        }

        scrollPosition = GUILayout.BeginScrollView(
            scrollPosition,
            GUILayout.Height(220f));

        int count = Mathf.Min(rooms.Count, Mathf.Max(1, maxVisibleRooms));
        for (int index = 0; index < count; index++)
        {
            DrawRoom(rooms[index]);
        }

        GUILayout.EndScrollView();
    }

    private void DrawRoom(RoomInfo room)
    {
        if (room == null)
        {
            return;
        }

        GUILayout.BeginVertical(GUI.skin.box);
        GUILayout.Label(room.RoomName + " | " + room.Status);
        GUILayout.Label(room.IpAddress + ":" + room.Port);
        GUILayout.Label(room.PlayerCount + "/" + room.MaxPlayers + " participants");

        string runtimeState = room.GetMetadataValue("runtimeSessionState", "");
        if (!string.IsNullOrWhiteSpace(runtimeState))
        {
            GUILayout.Label("Runtime: " + runtimeState);
        }

        if (GUILayout.Button("Join"))
        {
            runtimeFacade.JoinRoom(room.RoomId, out _);
        }

        GUILayout.EndVertical();
    }

    private string ResolveModeLabel()
    {
        return runtimeFacade != null
            ? runtimeFacade.ConnectionState.ToString()
            : "Offline";
    }

    private string ResolveAddress()
    {
        return runtimeFacade != null &&
            !string.IsNullOrWhiteSpace(runtimeFacade.NetworkAddress)
                ? runtimeFacade.NetworkAddress
                : "n/a";
    }

    private string FormatTime(float time)
    {
        if (time < 0f)
        {
            return "never";
        }

        return time.ToString("0.00") + "s";
    }

    private string FormatHttpStatus(long responseCode, int bytes)
    {
        return responseCode < 0
            ? "none"
            : responseCode + " (" + bytes + " bytes)";
    }

    private void ResolveReferences()
    {
        if (runtimeFacade == null)
        {
            runtimeFacade = GetComponent<XRMultiplayerRuntimeFacade>();
        }

        if (runtimeFacade == null)
        {
            runtimeFacade = FindObjectOfType<XRMultiplayerRuntimeFacade>();
        }

        if (runtimeFacade == null && autoCreateFacade)
        {
            runtimeFacade = gameObject.AddComponent<XRMultiplayerRuntimeFacade>();
        }

        // facade handles its own state internally
    }
}
