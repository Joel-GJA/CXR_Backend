using System.Collections.Generic;
using System.Text;
using CXR.SDK.Rooms;
using Mirror;
using UnityEngine;

public class ValidationSceneController : MonoBehaviour
{
    [Header("References")]
    [SerializeField]
    private XRMultiplayerRuntimeFacade runtimeFacade;

    [SerializeField]
    private XRNetworkManager networkManager;

    [SerializeField]
    private RuntimeSessionManager sessionManager;

    [Header("Validation Objects")]
    [SerializeField]
    private GameObject interactableCubePrefab;

    [SerializeField]
    private int cubeCount = 3;

    [SerializeField]
    private Vector3 cubeSpawnArea = new Vector3(0f, 1f, 2f);

    [Header("UI")]
    [SerializeField]
    private bool visible = true;

    [SerializeField]
    private KeyCode toggleKey = KeyCode.F2;

    [SerializeField]
    private Rect windowRect = new Rect(450f, 12f, 500f, 700f);

    [Header("Diagnostics")]
    [SerializeField]
    private int maxLogLines = 100;

    private readonly string[] tabLabels =
        { "Connection", "XR Presence", "Ownership", "Diagnostics" };

    private int selectedTab;
    private Vector2 scrollPosition;
    private Vector2 logScrollPosition;

    private readonly List<RuntimeInteractable> validationCubes =
        new List<RuntimeInteractable>();

    private readonly List<GameObject> spawnPointVisuals =
        new List<GameObject>();

    private XRConnectionStateProvider connectionState;

    private string directConnectAddress = "localhost";
    private readonly List<string> localIpAddresses = new List<string>();

    private readonly StringBuilder logBuilder = new StringBuilder();
    private readonly List<string> eventLog = new List<string>();

    private const string DirectAddressPrefsKey = "CXR_Validation_DirectAddress";

    private float lastMetricsRefresh;
    private int lastEntityCount;
    private float currentLatency;
    private int connectedClientCount;
    private int eventCountThisSession;
    private float autoRefreshTimer;
    private bool wasServerActive;
    private bool wasClientConnected;

    private const float MetricsRefreshRate = 0.5f;

    private void Awake()
    {
        connectionState = new XRConnectionStateProvider();
        ResolveReferences();
    }

    private void ResolveReferences()
    {
        if (runtimeFacade == null)
        {
            runtimeFacade = GetComponent<XRMultiplayerRuntimeFacade>()
                ?? FindObjectOfType<XRMultiplayerRuntimeFacade>();
        }

        if (networkManager == null)
        {
            networkManager = FindObjectOfType<XRNetworkManager>();
        }

        if (sessionManager == null)
        {
            sessionManager = RuntimeSessionManager.Instance
                ?? FindObjectOfType<RuntimeSessionManager>();
        }
    }

    private void Start()
    {
        LogEvent("Validation environment initialized");
        directConnectAddress = PlayerPrefs.GetString(
            DirectAddressPrefsKey, "localhost");
        SuppressSceneManagement();
        DisableRemoteRegistryPublisher();
        SubscribeToEvents();
        EnsureSceneEnvironment();
        SpawnSpawnPointVisuals();
        ResolveLocalIp();
    }

    private void ResolveLocalIp()
    {
        localIpAddresses.Clear();
        try
        {
            var host = System.Net.Dns.GetHostEntry(System.Net.Dns.GetHostName());
            foreach (var ip in host.AddressList)
            {
                if (ip.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork)
                {
                    localIpAddresses.Add(ip.ToString());
                }
            }
        }
        catch
        {
        }

        if (localIpAddresses.Count == 0)
        {
            localIpAddresses.Add("127.0.0.1");
        }
    }

    private void EnsureSceneEnvironment()
    {
        if (FindObjectOfType<Camera>() == null)
        {
            GameObject cameraObj = new GameObject("Main Camera");
            cameraObj.tag = "MainCamera";
            Camera cam = cameraObj.AddComponent<Camera>();
            cam.clearFlags = CameraClearFlags.Skybox;
            cam.nearClipPlane = 0.3f;
            cam.farClipPlane = 1000f;
            cam.fieldOfView = 60f;
            cameraObj.transform.position = new Vector3(0f, 6f, -8f);
            cameraObj.transform.rotation = Quaternion.Euler(25f, 0f, 0f);
            cameraObj.AddComponent<AudioListener>();
        }

        Light[] lights = FindObjectsOfType<Light>();
        bool hasDirectional = false;
        foreach (Light l in lights)
        {
            if (l.type == LightType.Directional)
            {
                hasDirectional = true;
                break;
            }
        }

        if (!hasDirectional)
        {
            GameObject lightObj = new GameObject("Directional Light");
            Light light = lightObj.AddComponent<Light>();
            light.type = LightType.Directional;
            light.intensity = 1f;
            light.shadows = LightShadows.Soft;
            lightObj.transform.position = new Vector3(0f, 10f, 0f);
            lightObj.transform.rotation = Quaternion.Euler(50f, -30f, 0f);
        }

        if (FindObjectOfType<UnityEngine.EventSystems.EventSystem>() == null)
        {
            GameObject esObj = new GameObject("EventSystem");
            esObj.AddComponent<UnityEngine.EventSystems.EventSystem>();
            esObj.AddComponent<UnityEngine.EventSystems.StandaloneInputModule>();
        }

        CreateGroundPlane();
    }

    private void CreateGroundPlane()
    {
        GameObject ground = GameObject.CreatePrimitive(PrimitiveType.Plane);
        ground.name = "Validation Ground";
        ground.transform.localScale = new Vector3(4f, 1f, 4f);
        ground.transform.position = new Vector3(0f, -0.5f, 0f);
        Renderer renderer = ground.GetComponent<Renderer>();
        if (renderer != null)
        {
            renderer.material.color = new Color(0.25f, 0.25f, 0.3f);
        }
    }

    private void DisableRemoteRegistryPublisher()
    {
        RemoteRoomRegistryPublisher publisher =
            FindObjectOfType<RemoteRoomRegistryPublisher>();
        if (publisher != null)
        {
            publisher.enabled = false;
        }
    }

    private void SubscribeToEvents()
    {
        if (sessionManager != null)
        {
            sessionManager.StateChanged += OnSessionStateChanged;
            sessionManager.ParticipantRegistered += OnParticipantRegistered;
            sessionManager.ParticipantUnregistered += OnParticipantUnregistered;
        }

    }

    private void OnDestroy()
    {
        if (sessionManager != null)
        {
            sessionManager.StateChanged -= OnSessionStateChanged;
            sessionManager.ParticipantRegistered -= OnParticipantRegistered;
            sessionManager.ParticipantUnregistered -= OnParticipantUnregistered;
        }
    }

    private void Update()
    {
        if (Input.GetKeyDown(toggleKey))
        {
            visible = !visible;
        }

        if (visible)
        {
            CollectDiagnostics();
        }
    }

    public void SpawnValidationCubes()
    {
        if (interactableCubePrefab == null || !NetworkServer.active)
            return;

        for (int i = 0; i < cubeCount; i++)
        {
            float xOffset = (i - (cubeCount - 1) / 2f) * 2f;
            Vector3 position = new Vector3(
                cubeSpawnArea.x + xOffset,
                cubeSpawnArea.y,
                cubeSpawnArea.z);

            GameObject cube = Instantiate(interactableCubePrefab,
                position, Quaternion.identity);
            NetworkServer.Spawn(cube);

            RuntimeInteractable interactable =
                cube.GetComponent<RuntimeInteractable>();
            if (interactable != null)
            {
                validationCubes.Add(interactable);
            }
        }

        LogEvent($"Spawned {cubeCount} validation cubes");
    }

    public void SpawnSpawnPointVisuals()
    {
        for (int i = 0; i < 4; i++)
        {
            float x = (i - 1.5f) * 3f;
            GameObject visual = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            visual.transform.position = new Vector3(x, 0.05f, 4f);
            visual.transform.localScale = new Vector3(0.5f, 0.1f, 0.5f);
            visual.name = $"SpawnPoint_{i}";

            Renderer renderer = visual.GetComponent<Renderer>();
            if (renderer != null)
            {
                renderer.material.color = Color.green;
            }

            DestroyImmediate(visual.GetComponent<Collider>());
            spawnPointVisuals.Add(visual);
        }

        LogEvent("Spawn point visuals placed");
    }

    private void CollectDiagnostics()
    {
        autoRefreshTimer += Time.deltaTime;
        if (autoRefreshTimer < MetricsRefreshRate)
            return;

        autoRefreshTimer = 0f;

        connectedClientCount = connectionState.ConnectedClientCount;

        bool isServer = NetworkServer.active;
        bool isClient = NetworkClient.isConnected;

        if (isServer && !wasServerActive)
        {
            LogEvent("Server activated");
            if (interactableCubePrefab != null && validationCubes.Count == 0)
                SpawnValidationCubes();
        }
        else if (!isServer && wasServerActive)
        {
            LogEvent("Server deactivated");
        }

        if (isClient && !wasClientConnected)
            LogEvent("Client connected");
        else if (!isClient && wasClientConnected)
            LogEvent("Client disconnected");

        wasServerActive = isServer;
        wasClientConnected = isClient;

        lastEntityCount = RuntimeEntityRegistry.GetAllEntities().Count;
    }

    private void OnSessionStateChanged(
        RuntimeSessionState prev, RuntimeSessionState next)
    {
        LogEvent($"Session state: {prev} -> {next}");
    }

    private void OnParticipantRegistered(RuntimeParticipant participant)
    {
        eventCountThisSession++;
        LogEvent($"Participant registered: NetID={participant.netId}");
    }

    private void OnParticipantUnregistered(RuntimeParticipant participant)
    {
        eventCountThisSession++;
        LogEvent($"Participant unregistered: NetID={participant.netId}");
    }

    private void LogEvent(string message)
    {
        string timestamp = Time.time.ToString("F2");
        string entry = $"[{timestamp}] {message}";
        eventLog.Add(entry);

        if (eventLog.Count > maxLogLines)
        {
            eventLog.RemoveAt(0);
        }
    }

    public void LogCustomEvent(string message)
    {
        LogEvent(message);
    }

    private void OnGUI()
    {
        if (!visible)
            return;

        GUI.enabled = !NetworkClient.isConnecting;

        try
        {
            windowRect = GUILayout.Window(
                GetInstanceID(),
                windowRect,
                DrawWindow,
                "Validation Reference Environment");
        }
        catch (System.Exception ex)
        {
            GUILayout.Label("Validation UI Error: " + ex.Message);
        }

        GUI.enabled = true;
    }

    private void DrawWindow(int windowId)
    {
        DrawConnectionStatusBar();
        GUILayout.Space(4f);

        selectedTab = GUILayout.Toolbar(selectedTab, tabLabels);
        GUILayout.Space(8f);

        switch (selectedTab)
        {
            case 0:
                DrawConnectionPanel();
                break;
            case 1:
                DrawXRPresencePanel();
                break;
            case 2:
                DrawOwnershipPanel();
                break;
            case 3:
                DrawDiagnosticsPanel();
                break;
        }

        GUI.DragWindow(new Rect(0f, 0f, 10000f, 24f));
    }

    private void DrawConnectionStatusBar()
    {
        GUILayout.BeginHorizontal(GUI.skin.box);

        string state = connectionState != null
            ? connectionState.ConnectionState.ToString()
            : "Offline";
        GUILayout.Label($"Status: {state}");

        GUILayout.FlexibleSpace();
        GUILayout.Label($"Clients: {connectedClientCount}");

        GUILayout.EndHorizontal();
    }

    private void DrawConnectionPanel()
    {
        GUILayout.Label("Connection Validation", GUI.skin.box);
        GUILayout.Space(4f);

        if (GUILayout.Button("1. Start Host"))
        {
            runtimeFacade?.StartHost();
            LogEvent("Host started");
        }

        if (GUILayout.Button("2. Start Server"))
        {
            runtimeFacade?.StartServer();
            LogEvent("Server started");
        }

        GUILayout.Label("Client Address");
        directConnectAddress = GUILayout.TextField(directConnectAddress);

        if (GUILayout.Button("3. Connect Client"))
        {
            PlayerPrefs.SetString(DirectAddressPrefsKey, directConnectAddress);
            runtimeFacade?.StartClient(directConnectAddress);
            LogEvent($"Client connecting to {directConnectAddress}");
        }

        if (GUILayout.Button("4. Disconnect"))
        {
            runtimeFacade?.StopClient();
            LogEvent("Client disconnected");
        }

        if (GUILayout.Button("5. Stop Host/Server"))
        {
            runtimeFacade?.Stop();
            LogEvent("Host/Server stopped");
        }

        GUILayout.Space(8f);
        if (NetworkServer.active)
        {
            int port = GetPort();
            GUILayout.Label("Connect from another machine using:");
            foreach (string ip in localIpAddresses)
            {
                GUILayout.Label($"  {ip}:{port}");
            }
        }

        GUILayout.Space(4f);
        GUILayout.Label("Session Status");
        GUILayout.Label($"State: {runtimeFacade?.SessionState}");
        GUILayout.Label($"Participants: {runtimeFacade?.ParticipantCount}");
        GUILayout.Label($"Connected Clients: {runtimeFacade?.ConnectedClientCount}");
    }

    private void DrawXRPresencePanel()
    {
        GUILayout.Label("XR Presence Validation", GUI.skin.box);
        GUILayout.Space(4f);

        GUILayout.Label("Spawn Points", GUILayout.ExpandWidth(false));
        GUILayout.Label("4 spawn point markers placed at z=4");

        if (GUILayout.Button("Respawn Spawn Point Visuals"))
        {
            ClearSpawnPointVisuals();
            SpawnSpawnPointVisuals();
        }

        GUILayout.Space(8f);
        GUILayout.Label("Local Player");
        GUILayout.Label($"NetID: {connectionState?.LocalPlayerNetId}");
        GUILayout.Label($"Connection ID: {connectionState?.LocalConnectionId}");

        if (NetworkClient.localPlayer != null)
        {
            Transform t = NetworkClient.localPlayer.transform;
            GUILayout.Label($"Position: {t.position:F2}");
            GUILayout.Label($"Rotation: {t.eulerAngles:F1}");
        }

        GUILayout.Space(8f);
        GUILayout.Label("Remote Participants");

        if (sessionManager != null)
        {
            int count = 0;
            foreach (RuntimeParticipantInfo info in sessionManager.ParticipantInfos)
            {
                count++;
                GUILayout.Label($"  [{count}] NetID={info.ParticipantNetId}, " +
                    $"ConnID={info.ConnectionId}, " +
                    $"Connected={info.IsConnected}");
            }

            if (count == 0)
            {
                GUILayout.Label("  No remote participants");
            }
        }
    }

    private void DrawOwnershipPanel()
    {
        GUILayout.Label("Ownership Validation", GUI.skin.box);
        GUILayout.Space(4f);

        GUILayout.Label("Interactable Cubes");
        GUILayout.Label("Press P to grab, R to release");
        GUILayout.Label("Cubes auto-spawn when host/server starts");

        if (NetworkServer.active && validationCubes.Count == 0
            && interactableCubePrefab != null)
        {
            if (GUILayout.Button("Spawn Validation Cubes"))
            {
                SpawnValidationCubes();
            }
        }

        GUILayout.Space(4f);
        scrollPosition = GUILayout.BeginScrollView(scrollPosition,
            GUILayout.Height(300f));

        int cubeIndex = 0;
        foreach (RuntimeInteractable cube in validationCubes)
        {
            if (cube == null)
                continue;

            cubeIndex++;
            GUILayout.BeginVertical(GUI.skin.box);

            GUILayout.Label($"Cube {cubeIndex} | NetID={cube.netId}");
            GUILayout.Label($"  State: {cube.CurrentInteractableState}");

            bool isGrabbed = cube.IsGrabbed;
            uint holder = cube.HoldingPlayerNetId;
            GUILayout.Label($"  Held by: {(isGrabbed ? holder.ToString() : "none")}");
            GUILayout.Label($"  Position: {cube.transform.position:F2}");

            if (isGrabbed)
            {
                string holderName = "unknown";
                if (NetworkClient.spawned.TryGetValue(holder,
                    out NetworkIdentity identity))
                {
                    holderName = identity.name;
                }

                GUI.color = Color.yellow;
                GUILayout.Label($"  Holder: {holderName}");
                GUI.color = Color.white;
            }

            NetworkIdentity cubeIdentity = cube.netIdentity;
            if (cubeIdentity != null && cubeIdentity.connectionToClient != null)
            {
                GUILayout.Label($"  Authority: connection " +
                    $"{cubeIdentity.connectionToClient.connectionId}");
            }
            else
            {
                GUILayout.Label($"  Authority: none (server)");
            }

            GUILayout.EndVertical();
            GUILayout.Space(4f);
        }

        if (cubeIndex == 0)
        {
            GUILayout.Label("No validation cubes spawned yet.");
        }

        GUILayout.EndScrollView();
    }

    private void DrawDiagnosticsPanel()
    {
        GUILayout.Label("Real-time Diagnostics", GUI.skin.box);
        GUILayout.Space(4f);

        GUILayout.Label("Network Metrics");
        GUILayout.Label($"  Registered Entities: {lastEntityCount}");
        GUILayout.Label($"  Connected Clients: {connectedClientCount}");
        GUILayout.Label($"  Events This Session: {eventCountThisSession}");

        if (NetworkClient.active)
        {
            GUILayout.Label($"  Network Time: {NetworkTime.time:F3}");
            GUILayout.Label($"  Network Ping: {NetworkTime.rtt * 1000:F0}ms");
        }

        GUILayout.Space(8f);
        GUILayout.Label("Session");

        if (sessionManager != null)
        {
            GUILayout.Label($"  State: {sessionManager.State}");
            GUILayout.Label($"  Participants: {sessionManager.ParticipantCount}");
            GUILayout.Label($"  Participant Infos: {sessionManager.ParticipantInfos.Count}");
        }

        GUILayout.Space(8f);
        GUILayout.Label("Validation Event Log");

        logScrollPosition = GUILayout.BeginScrollView(logScrollPosition,
            GUILayout.Height(250f));

        GUILayout.BeginVertical(GUI.skin.box);
        for (int i = 0; i < eventLog.Count; i++)
        {
            GUILayout.Label(eventLog[i]);
        }

        GUILayout.EndVertical();
        GUILayout.EndScrollView();

        if (GUILayout.Button("Clear Log"))
        {
            eventLog.Clear();
        }
    }

    private void SuppressSceneManagement()
    {
        if (networkManager != null)
        {
            networkManager.offlineScene = string.Empty;
            networkManager.onlineScene = string.Empty;
        }
    }

    private int GetPort()
    {
        try
        {
            if (networkManager != null && networkManager.transport != null)
            {
                var transportType = networkManager.transport.GetType();
                var portProp = transportType.GetProperty("Port") ??
                               transportType.GetProperty("port") ??
                               transportType.GetProperty("ServerPort");
                if (portProp != null && portProp.GetValue(networkManager.transport) is int port)
                    return port;
            }
        }
        catch
        {
        }

        return 7777;
    }

    private void ClearSpawnPointVisuals()
    {
        foreach (GameObject visual in spawnPointVisuals)
        {
            if (visual != null)
            {
                DestroyImmediate(visual);
            }
        }

        spawnPointVisuals.Clear();
    }

    private void OnDrawGizmos()
    {
        Gizmos.color = Color.green;
        for (int i = 0; i < 4; i++)
        {
            float x = (i - 1.5f) * 3f;
            Gizmos.DrawWireSphere(new Vector3(x, 0.5f, 4f), 0.3f);
        }

        Gizmos.color = Color.cyan;
        for (int i = 0; i < cubeCount; i++)
        {
            float xOffset = (i - (cubeCount - 1) / 2f) * 2f;
            Vector3 pos = new Vector3(
                cubeSpawnArea.x + xOffset,
                cubeSpawnArea.y,
                cubeSpawnArea.z);
            Gizmos.DrawWireCube(pos, Vector3.one);
        }
    }
}
