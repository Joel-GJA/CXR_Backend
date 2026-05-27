using System.Collections.Generic;
using System.Text;
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

    [Header("Diagnostics Overlay")]
    [SerializeField]
    private bool showEventStream = true;

    [SerializeField]
    private bool showNetworkHealth = true;

    [SerializeField]
    private bool showSyncVisualization = true;

    [SerializeField]
    private int maxEventStreamLines = 50;

    private const string DirectAddressPrefsKey = "CXR_DebugGUI_DirectAddress";
    private const string RegistryUrlPrefsKey = "CXR_DebugGUI_RegistryUrl";

    private Vector2 mainScrollPosition;

    private readonly List<string> eventStreamBuffer = new List<string>();
    private readonly Dictionary<uint, ClientNetworkState> clientStates = new Dictionary<uint, ClientNetworkState>();
    private float networkHealthLastUpdate;
    private int lastTotalEvents;
    private float lastEventRateUpdate;
    private float eventsPerSecond;

    private int activeTabIndex;
    private readonly string[] tabLabels = { "Network", "Discovery", "Events", "Health", "Sync" };

    private void Awake()
    {
        LoadPersistedUrls();
        ResolveReferences();
    }

    private void LoadPersistedUrls()
    {
        string savedAddress = PlayerPrefs.GetString(
            DirectAddressPrefsKey, "localhost");
        if (!string.IsNullOrWhiteSpace(savedAddress))
        {
            directConnectAddress = savedAddress;
        }

        string savedRegistryUrl = PlayerPrefs.GetString(
            RegistryUrlPrefsKey, string.Empty);
        if (!string.IsNullOrWhiteSpace(savedRegistryUrl))
        {
            remoteRegistryUrl = savedRegistryUrl;
        }
    }

    private void SaveDirectConnectAddress()
    {
        PlayerPrefs.SetString(DirectAddressPrefsKey, directConnectAddress);
        PlayerPrefs.Save();
    }

    private void SaveRegistryUrl()
    {
        PlayerPrefs.SetString(RegistryUrlPrefsKey, remoteRegistryUrl);
        PlayerPrefs.Save();
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
            SaveDirectConnectAddress();
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
            SaveRegistryUrl();
        }

        if (GUILayout.Button("Refresh Registry"))
        {
            runtimeFacade.RemoteRegistryUrl = remoteRegistryUrl;
            SaveRegistryUrl();
            runtimeFacade.RefreshRemoteRooms();
        }
        GUILayout.EndHorizontal();

        if (GUILayout.Button("Advertise Room"))
        {
            runtimeFacade.RemoteRegistryUrl = remoteRegistryUrl;
            SaveRegistryUrl();
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

        int count = Mathf.Min(rooms.Count, Mathf.Max(1, maxVisibleRooms));
        for (int index = 0; index < count; index++)
        {
            DrawRoom(rooms[index]);
        }
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

    // ===== Tabs =====

    private void DrawWindow(int windowId)
    {
        DrawTabBar();
        mainScrollPosition = GUILayout.BeginScrollView(mainScrollPosition);

        switch (activeTabIndex)
        {
            case 0:
                DrawNetworkLifecycle();
                GUILayout.Space(8f);
                DrawSessionSnapshot();
                break;
            case 1:
                DrawDiscoveryLifecycle();
                GUILayout.Space(8f);
                DrawRemoteRegistry();
                GUILayout.Space(8f);
                DrawRoomBrowser();
                break;
            case 2: DrawEventStream(); break;
            case 3: DrawNetworkHealth(); break;
            case 4: DrawSyncVisualization(); break;
        }

        GUILayout.EndScrollView();
        GUI.DragWindow(new Rect(0f, 0f, 10000f, 24f));
    }

    private void DrawTabBar()
    {
        GUILayout.BeginHorizontal(GUI.skin.box);
        for (int i = 0; i < tabLabels.Length; i++)
        {
            bool isActive = i == activeTabIndex;
            string label = isActive ? "[" + tabLabels[i] + "]" : tabLabels[i];
            GUIStyle activeStyle = new GUIStyle(GUI.skin.label) { fontStyle = FontStyle.Bold };
            if (GUILayout.Button(label, isActive ? activeStyle : GUI.skin.label))
            {
                activeTabIndex = i;
            }
        }
        GUILayout.EndHorizontal();
        GUILayout.Space(4f);
    }

    // ===== Tab 2: Event Stream =====

    private void DrawEventStream()
    {
        GUILayout.Label("Runtime Event Stream", EditorStyles.boldLabel);

        if (!showEventStream)
        {
            GUILayout.Label("Event stream is disabled. Enable showEventStream in the Inspector.");
            return;
        }

        SubscribeToRuntimeEvents();

        GUILayout.Label($"Events/s: {eventsPerSecond:F1} | Buffer: {eventStreamBuffer.Count}/{maxEventStreamLines}");

        if (GUILayout.Button("Clear Events"))
        {
            eventStreamBuffer.Clear();
        }

        GUILayout.Space(4f);

        StringBuilder sb = new StringBuilder();
        int start = Mathf.Max(0, eventStreamBuffer.Count - 30);
        for (int i = start; i < eventStreamBuffer.Count; i++)
        {
            sb.AppendLine(eventStreamBuffer[i]);
        }

        GUILayout.TextArea(sb.ToString(), GUILayout.ExpandHeight(true), GUILayout.MinHeight(200));
    }

    private bool eventStreamSubscribed;
    private void SubscribeToRuntimeEvents()
    {
        if (eventStreamSubscribed) return;
        RuntimeEventEmitter.EventEmitted += OnDebugGuiRuntimeEvent;
        eventStreamSubscribed = true;
    }

    private void OnDebugGuiRuntimeEvent(RuntimeEvent evt)
    {
        string line = $"{evt.timestampUtc.Substring(11, 8)} [{evt.eventType}] {evt.source}: {evt.message}";
        eventStreamBuffer.Add(line);
        while (eventStreamBuffer.Count > maxEventStreamLines)
        {
            eventStreamBuffer.RemoveAt(0);
        }
    }

    // ===== Tab 3: Network Health =====

    private void DrawNetworkHealth()
    {
        GUILayout.Label("Network Health", EditorStyles.boldLabel);

        if (!showNetworkHealth)
        {
            GUILayout.Label("Network health panel is disabled.");
            return;
        }

        if (NetworkClient.active)
        {
            GUILayout.Label("Connected: yes");
            if (NetworkTime.pingInterval > 0)
            {
                GUILayout.Label($"Ping: {NetworkTime.rtt * 1000:F0} ms");
            }
        }
        else
        {
            GUILayout.Label("Connected: no");
        }

        if (NetworkServer.active)
        {
            GUILayout.Label("Server mode: active");
            GUILayout.Label($"Connected clients: {NetworkServer.connections.Count}");

            int totalPlayers = 0;
            foreach (KeyValuePair<int, NetworkConnectionToClient> kvp in NetworkServer.connections)
            {
                if (kvp.Value != null && kvp.Value.identity != null)
                    totalPlayers++;
            }
            GUILayout.Label($"Players: {totalPlayers}");
        }

        NetworkManager net = FindObjectOfType<NetworkManager>();
        if (net != null)
        {
            GUILayout.Label($"Network Address: {net.networkAddress}");
            GUILayout.Label($"Max Connections: {net.maxConnections}");
        }

        GUILayout.Space(8);

        if (runtimeFacade != null)
        {
            GUILayout.Label("Runtime Facade");
            GUILayout.Label($"State: {runtimeFacade.SessionState}");
            GUILayout.Label($"Participants: {runtimeFacade.ParticipantCount}");
            GUILayout.Label($"Connected Clients: {runtimeFacade.ConnectedClientCount}");
        }
    }

    // ===== Tab 4: Sync Visualization =====

    private void DrawSyncVisualization()
    {
        GUILayout.Label("Sync Visualization", EditorStyles.boldLabel);

        if (!showSyncVisualization)
        {
            GUILayout.Label("Sync visualization is disabled.");
            return;
        }

        if (!NetworkServer.active && !NetworkClient.active)
        {
            GUILayout.Label("Not connected to any network.");
            return;
        }

        NetworkIdentity[] identities = FindObjectsOfType<NetworkIdentity>();
        int synced = 0;
        int totalNetIds = 0;

        GUILayout.Label($"NetworkIdentities in scene: {identities.Length}");

        foreach (NetworkIdentity id in identities)
        {
            if (id.netId == 0) continue;
            totalNetIds++;

            NetworkTransformBase nt = id.GetComponent<NetworkTransformBase>();
            if (nt != null) synced++;
        }

        GUILayout.Label($"Total spawned: {totalNetIds}");
        GUILayout.Label($"With NetworkTransform: {synced}");

        GUILayout.Space(8);

        if (totalNetIds > 0)
        {
            GUILayout.Label("Per-Client Transform State", EditorStyles.boldLabel);
            foreach (NetworkIdentity id in identities)
            {
                if (id.netId == 0) continue;
                NetworkTransformBase nt = id.GetComponent<NetworkTransformBase>();
                if (nt == null) continue;

                GUILayout.BeginVertical(GUI.skin.box);
                GUILayout.Label($"[{id.netId}] {id.name}");
                GUILayout.Label($"  Sync: pos={nt.syncPosition} rot={nt.syncRotation} scale={nt.syncScale}");
                GUILayout.Label($"  Interval: {nt.sendInterval}s | Interp: pos={nt.interpolatePosition} rot={nt.interpolateRotation}");
                GUILayout.EndVertical();
            }
        }

        if (NetworkServer.active)
        {
            GUILayout.Space(8);
            GUILayout.Label("Connected Clients", EditorStyles.boldLabel);
            foreach (KeyValuePair<int, NetworkConnectionToClient> kvp in NetworkServer.connections)
            {
                if (kvp.Value == null) continue;
                NetworkConnectionToClient conn = kvp.Value;
                GUILayout.BeginVertical(GUI.skin.box);
                GUILayout.Label($"Connection {conn.connectionId} | Address: {conn.address}");
                GUILayout.Label($"  Identity: {(conn.identity != null ? conn.identity.name : "none")} | IsReady: {conn.isReady}");
                GUILayout.EndVertical();
            }
        }
    }

    private struct ClientNetworkState
    {
        public uint netId;
        public string objectName;
        public float lastUpdateTime;
        public int syncCount;
    }
}
