using System.Collections.Generic;
using CXR.SDK.Discovery;
using Mirror;
using UnityEngine;

#if UNITY_EDITOR
using UnityEditor;
#endif

[DisallowMultipleComponent]
public class XRNetworkManager : NetworkManager
{
    [Header("Scene Flow")]
    [Scene]
    [SerializeField]
    private string lobbyScene =
        "Assets/Multiplayer/Scenes/LobbyScene.unity";

    [Scene]
    [SerializeField]
    private string sessionScene =
        "Assets/Multiplayer/Scenes/SessionScene.unity";

    [SerializeField]
    private bool configureSceneFlowOnAwake = true;

    [Header("Transport")]
    [SerializeField]
    private Transport preferredTransport;

    [SerializeField]
    private bool assignActiveTransportOnAwake = true;

    [Header("Runtime Session")]
    [SerializeField]
    private RuntimeSessionManager sessionManager;

    [SerializeField]
    private bool autoCreateRuntimeComponents = true;

    [Header("Discovery")]
    [SerializeField]
    private bool enableSdkDiscoveryBridge = true;

    [SerializeField]
    private RuntimeSessionSdkBridge sessionSdkBridge;

    [SerializeField]
    private DiscoveryListener discoveryListener;

    [SerializeField]
    private DiscoveryBroadcaster discoveryBroadcaster;

    [SerializeField]
    private bool autoCreateDiscoveryComponents = true;

    [Header("Runtime Spawn Prefabs")]
    [SerializeField]
    private bool registerDefaultResourceSpawnPrefab = true;

    [SerializeField]
    private string defaultResourceSpawnPrefabPath = "SpawnableCarryObject";

    [SerializeField]
    private List<GameObject> runtimeSpawnPrefabs = new List<GameObject>();

    private readonly Dictionary<int, NetworkConnectionToClient>
        connectedClients = new Dictionary<int, NetworkConnectionToClient>();

    public bool ServerActive { get; private set; }

    public RuntimeSessionManager SessionManager => sessionManager;

    public RuntimeSessionSdkBridge SessionSdkBridge => sessionSdkBridge;

    public DiscoveryListener DiscoveryListener => discoveryListener;

    public DiscoveryBroadcaster DiscoveryBroadcaster => discoveryBroadcaster;

    public override void Awake()
    {
        base.Awake();

        if (singleton != this)
            return;

        ConfigureTransport();
        ConfigureSceneFlow();
        ResolveRuntimeInfrastructure();
        ConfigureDiscovery();
        RegisterRuntimeSpawnPrefabs();
    }

    private void ConfigureSceneFlow()
    {
        if (!configureSceneFlowOnAwake)
        {
            return;
        }

        if (!string.IsNullOrWhiteSpace(lobbyScene))
        {
            offlineScene = lobbyScene;
        }

        if (!string.IsNullOrWhiteSpace(sessionScene))
        {
            onlineScene = sessionScene;
        }
    }

    public void SetSessionScene(string scenePath)
    {
        sessionScene = scenePath;
        if (!string.IsNullOrWhiteSpace(sessionScene))
            onlineScene = sessionScene;
    }

    public void LoadScene(string scenePath)
    {
        if (!NetworkServer.active)
        {
            Debug.LogWarning("[NETWORK] Cannot load scene — server is not active.");
            return;
        }
        ServerChangeScene(scenePath);
    }

    private void ConfigureTransport()
    {
        if (preferredTransport == null)
        {
            preferredTransport = transport != null
                ? transport
                : GetComponent<Transport>();
        }

        if (preferredTransport == null)
        {
            return;
        }

        transport = preferredTransport;

        if (assignActiveTransportOnAwake)
        {
            Transport.active = preferredTransport;
        }
    }

    private void RegisterRuntimeSpawnPrefabs()
    {
        if (registerDefaultResourceSpawnPrefab &&
            !string.IsNullOrWhiteSpace(defaultResourceSpawnPrefabPath))
        {
            GameObject defaultPrefab =
                Resources.Load<GameObject>(defaultResourceSpawnPrefabPath);

            AddSpawnPrefabIfMissing(defaultPrefab);
        }

        for (int index = 0; index < runtimeSpawnPrefabs.Count; index++)
        {
            AddSpawnPrefabIfMissing(runtimeSpawnPrefabs[index]);
        }
    }

    private void AddSpawnPrefabIfMissing(GameObject prefab)
    {
        if (prefab == null || spawnPrefabs.Contains(prefab))
        {
            return;
        }

        spawnPrefabs.Add(prefab);
    }

    // =========================
    // SERVER LIFECYCLE
    // =========================

    public override void OnStartServer()
    {
        base.OnStartServer();

        ServerActive = true;
        ResolveRuntimeInfrastructure();
        ConfigureDiscovery();

        if (sessionManager != null)
        {
            sessionManager.BeginServerSession();
        }

        if (sessionSdkBridge != null)
        {
            sessionSdkBridge.PublishSessionAdvertisement();
        }

        Debug.Log("[SERVER] Runtime Started");

        ValidateInteractableNetworkTransforms();

        PrintRuntimeState();
    }

    public override void OnStartHost()
    {
        base.OnStartHost();

        Debug.Log("[HOST] Runtime Host Started");
    }

    public override void OnStopHost()
    {
        Debug.Log("[HOST] Runtime Host Stopped");

        base.OnStopHost();
    }

    public override void OnStopServer()
    {
        if (sessionManager != null)
        {
            sessionManager.ShutdownSession();
        }

        base.OnStopServer();

        ServerActive = false;

        connectedClients.Clear();

        Debug.Log("[SERVER] Runtime Stopped");

        PrintRuntimeState();
    }

    // =========================
    // CONNECTION LIFECYCLE
    // =========================

    public override void OnServerConnect(NetworkConnectionToClient conn)
    {
        base.OnServerConnect(conn);

        if (!connectedClients.ContainsKey(conn.connectionId))
        {
            connectedClients.Add(conn.connectionId, conn);
        }

        Debug.Log(
            $"[SERVER] Client Connected | " +
            $"ConnectionID={conn.connectionId}");

        PrintRuntimeState();
    }

    public override void OnServerDisconnect(NetworkConnectionToClient conn)
    {
        Debug.Log(
            $"[SERVER] Client Disconnected | " +
            $"ConnectionID={conn.connectionId}");

        connectedClients.Remove(conn.connectionId);

        if (sessionManager != null)
        {
            sessionManager.HandleClientDisconnect(conn);
        }
        
        base.OnServerDisconnect(conn);

        PrintRuntimeState();
    }

    // =========================
    // CLIENT LIFECYCLE
    // =========================

    public override void OnClientConnect()
    {
        base.OnClientConnect();

        Debug.Log("[CLIENT] Connected To Runtime");
    }

    public override void OnClientDisconnect()
    {
        base.OnClientDisconnect();

        Debug.Log("[CLIENT] Disconnected From Runtime");
    }

    private void ResolveRuntimeInfrastructure()
    {
        ResolveSessionManager();
        ResolveSdkBridge();
    }

    private void ResolveSessionManager()
    {
        if (!autoCreateRuntimeComponents && sessionManager == null)
        {
            sessionManager = GetComponent<RuntimeSessionManager>();
        }

        if (sessionManager != null)
        {
            return;
        }

        sessionManager =
            RuntimeSessionManager.Instance ??
            GetComponent<RuntimeSessionManager>();

        if (sessionManager == null)
        {
            sessionManager =
                FindObjectOfType<RuntimeSessionManager>();
        }

        if (sessionManager == null && autoCreateRuntimeComponents)
        {
            sessionManager =
                gameObject.AddComponent<RuntimeSessionManager>();
        }
    }

    private void ResolveSdkBridge()
    {
        if (!enableSdkDiscoveryBridge)
        {
            return;
        }

        if (!autoCreateRuntimeComponents && sessionSdkBridge == null)
        {
            sessionSdkBridge = GetComponent<RuntimeSessionSdkBridge>();
        }

        if (sessionSdkBridge != null)
        {
            return;
        }

        sessionSdkBridge = GetComponent<RuntimeSessionSdkBridge>();
        if (sessionSdkBridge == null)
        {
            sessionSdkBridge =
                FindObjectOfType<RuntimeSessionSdkBridge>();
        }

        if (sessionSdkBridge == null && autoCreateRuntimeComponents)
        {
            sessionSdkBridge =
                gameObject.AddComponent<RuntimeSessionSdkBridge>();
        }
    }

    private void ConfigureDiscovery()
    {
        if (!enableSdkDiscoveryBridge)
        {
            return;
        }

        ResolveDiscoveryComponents();

        if (discoveryListener != null && discoveryBroadcaster != null)
        {
            discoveryListener.SetBroadcaster(discoveryBroadcaster);
        }

        if (sessionSdkBridge != null)
        {
            sessionSdkBridge.Initialize(discoveryBroadcaster, discoveryListener);
        }

        RemoteRoomRegistryPublisher registryPublisher =
            GetComponent<RemoteRoomRegistryPublisher>();
        if (registryPublisher != null)
        {
            registryPublisher.Initialize(discoveryBroadcaster);
        }

        HeadlessServerLauncher headlessLauncher =
            GetComponent<HeadlessServerLauncher>();
        if (headlessLauncher != null)
        {
            headlessLauncher.Initialize(
                discoveryBroadcaster,
                sessionSdkBridge,
                registryPublisher);
        }
    }

    private void ResolveDiscoveryComponents()
    {
        if (discoveryListener == null)
        {
            discoveryListener = GetComponent<DiscoveryListener>();
        }

        if (discoveryListener == null && autoCreateDiscoveryComponents)
        {
            discoveryListener =
                gameObject.AddComponent<DiscoveryListener>();
        }

        if (discoveryBroadcaster == null)
        {
            discoveryBroadcaster = GetComponent<DiscoveryBroadcaster>();
        }

        if (discoveryBroadcaster == null && autoCreateDiscoveryComponents)
        {
            discoveryBroadcaster =
                gameObject.AddComponent<DiscoveryBroadcaster>();
        }
    }

    // =========================
    // DIAGNOSTICS
    // =========================

    public int GetConnectedClientCount()
    {
        return connectedClients.Count;
    }

    private void PrintRuntimeState()
    {
        Debug.Log(
            $"[RUNTIME] " +
            $"ServerActive={ServerActive} | " +
            $"ConnectedClients={connectedClients.Count}");
    }

    public override void Reset()
    {
        base.Reset();

        preferredTransport = GetComponent<Transport>();
        sessionManager = GetComponent<RuntimeSessionManager>();
        sessionSdkBridge = GetComponent<RuntimeSessionSdkBridge>();
        discoveryListener = GetComponent<DiscoveryListener>();
        discoveryBroadcaster = GetComponent<DiscoveryBroadcaster>();
    }

    public override void OnValidate()
    {
        base.OnValidate();

        if (preferredTransport == null)
        {
            preferredTransport = GetComponent<Transport>();
        }

        if (sessionManager == null)
        {
            sessionManager = GetComponent<RuntimeSessionManager>();
        }

        if (sessionSdkBridge == null)
        {
            sessionSdkBridge = GetComponent<RuntimeSessionSdkBridge>();
        }

        if (discoveryListener == null)
        {
            discoveryListener = GetComponent<DiscoveryListener>();
        }

        if (discoveryBroadcaster == null)
        {
            discoveryBroadcaster = GetComponent<DiscoveryBroadcaster>();
        }
    }

    private void ValidateInteractableNetworkTransforms()
    {
        RuntimeInteractable[] interactables = FindObjectsByType<RuntimeInteractable>(
            FindObjectsSortMode.None);

        foreach (RuntimeInteractable interactable in interactables)
        {
            if (interactable.TryGetComponent(out NetworkTransformReliable ntr))
            {
                if (ntr.syncDirection != SyncDirection.ClientToServer)
                {
                    Debug.LogWarning(
                        $"[SERVER] Interactable '{interactable.name}' " +
                        $"has syncDirection={ntr.syncDirection}. " +
                        $"Expected ClientToServer ({SyncDirection.ClientToServer}).");
                }
            }
        }
    }
}
