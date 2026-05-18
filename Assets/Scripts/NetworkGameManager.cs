using Mirror;
using UnityEngine;

public class NetworkGameManager : NetworkBehaviour
{
    public static NetworkGameManager Instance { get; private set; }

    [Header("Lobby Scene")]
    [Scene] [SerializeField] private string lobbySceneName = "Assets/Multiplayer/Scenes/LobbyScene.unity";

    private void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }

        Instance = this;
    }

    private void OnDestroy()
    {
        if (Instance == this)
        {
            Instance = null;
        }
    }

    public void RequestSessionReset(SimplePlayerMovement player)
    {
        if (!NetworkClient.isConnected || player == null)
        {
            Debug.LogWarning("[SESSION] Reset requested without a valid local player.");
            return;
        }

        player.CmdResetMyPosition();
    }

    public void RequestReturnToLobby()
    {
        if (isServer)
        {
            ServerReturnEveryoneToLobby();
            return;
        }

        if (NetworkManager.singleton != null)
        {
            Debug.Log("[SESSION] Client leaving current session.");
            NetworkManager.singleton.StopClient();
        }
    }

    [Server]
    public void ServerReturnEveryoneToLobby()
    {
        NetworkManager manager = NetworkManager.singleton;
        if (manager == null)
        {
            Debug.LogWarning("[SERVER] Cannot return to lobby because there is no active NetworkManager.");
            return;
        }

        string targetLobbyScene = string.IsNullOrWhiteSpace(lobbySceneName)
            ? manager.offlineScene
            : lobbySceneName;

        if (!string.IsNullOrWhiteSpace(targetLobbyScene) && manager.offlineScene != targetLobbyScene)
        {
            manager.offlineScene = targetLobbyScene;
        }

        Debug.Log($"[SERVER] Closing session and returning everyone to lobby: {manager.offlineScene}");
        manager.StopHost();
    }
}
