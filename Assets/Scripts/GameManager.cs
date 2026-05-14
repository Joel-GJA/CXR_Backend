using Mirror;
using UnityEngine;

public class GameManager : MonoBehaviour
{
    public static GameManager Instance { get; private set; }

    [Header("Spawn Points")]
    [SerializeField] private Transform[] spawnPoints;

    [Header("Game State")]
    [SerializeField] private bool gameActive;

    public bool GameActive => gameActive;
    public bool HasSpawnPoints => spawnPoints != null && spawnPoints.Length > 0;

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

    [Server]
    public bool TryResetPlayer(SimplePlayerMovement player)
    {
        if (player == null || !HasSpawnPoints)
        {
            return false;
        }

        ResetPlayerPosition(player);
        gameActive = true;
        return true;
    }

    [Server]
    public void ResetAllPlayers()
    {
        if (!HasSpawnPoints)
        {
            Debug.LogWarning("[GAME] Reset requested, but no spawn points are configured.");
            return;
        }

        SimplePlayerMovement[] players = FindObjectsByType<SimplePlayerMovement>(FindObjectsSortMode.None);
        foreach (SimplePlayerMovement player in players)
        {
            ResetPlayerPosition(player);
        }

        gameActive = true;
        Debug.Log($"[GAME] Reset {players.Length} player(s) to spawn points.");
    }

    [Server]
    public void StopGame()
    {
        gameActive = false;
    }

    [Server]
    private void ResetPlayerPosition(SimplePlayerMovement player)
    {
        int spawnIndex = GetSpawnIndex(player.netId);
        Transform spawnPoint = spawnPoints[spawnIndex];
        player.ApplySpawnReset(spawnPoint.position, spawnPoint.rotation);
    }

    private int GetSpawnIndex(uint netId)
    {
        if (!HasSpawnPoints)
        {
            return 0;
        }

        return (int)(netId % (uint)spawnPoints.Length);
    }
}
