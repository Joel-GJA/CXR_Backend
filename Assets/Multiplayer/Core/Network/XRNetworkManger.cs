using System.Collections.Generic;
using Mirror;
using UnityEngine;

public class XRNetworkManager : NetworkManager
{
    [Header("Scene Flow")]
    [Scene] [SerializeField] private string lobbyScene = "Assets/Multiplayer/Scenes/RoomScene.unity";
    [Scene] [SerializeField] private string gameplayScene = "Assets/Multiplayer/Scenes/GameMapScene.unity";

    // Runtime state registry
    private readonly Dictionary<int, NetworkConnectionToClient> connectedClients
        = new Dictionary<int, NetworkConnectionToClient>();

    [Header("Runtime State")]
    [SerializeField] private bool serverActive = false;

    public override void Awake()
    {
        base.Awake();

        offlineScene = lobbyScene;
        onlineScene = gameplayScene;

        GameObject spawnableCarryObjectPrefab = Resources.Load<GameObject>("SpawnableCarryObject");
        if (spawnableCarryObjectPrefab != null && !spawnPrefabs.Contains(spawnableCarryObjectPrefab))
        {
            spawnPrefabs.Add(spawnableCarryObjectPrefab);
        }
    }

    // =========================
    // SERVER LIFECYCLE
    // =========================

    public override void OnStartServer()
    {
        serverActive = true;

        Debug.Log("[SERVER] Runtime Started");

        base.OnStartServer();
    }

    public override void OnStopServer()
    {
        serverActive = false;

        connectedClients.Clear();

        Debug.Log("[SERVER] Runtime Stopped");

        base.OnStopServer();
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

        Debug.Log($"[SERVER] Client Connected | ID: {conn.connectionId}");

        PrintRuntimeState();
    }

    public override void OnServerDisconnect(NetworkConnectionToClient conn)
    {
        Debug.Log($"[SERVER] Client Disconnected | ID: {conn.connectionId}");

        if (connectedClients.ContainsKey(conn.connectionId))
        {
            connectedClients.Remove(conn.connectionId);
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

    // =========================
    // RUNTIME DIAGNOSTICS
    // =========================

    private void PrintRuntimeState()
    {
        Debug.Log(
            $"[RUNTIME STATE] " +
            $"ServerActive={serverActive} | " +
            $"ConnectedClients={connectedClients.Count}"
        );
    }
}
