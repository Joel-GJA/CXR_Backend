using Mirror;
using UnityEngine;

public class NetworkGameManager : NetworkBehaviour
{
    public static NetworkGameManager Instance { get; private set; }

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

        Debug.Log($"[SERVER] Closing session and returning everyone to lobby.");
        manager.StopHost();
    }
}
