using UnityEngine;
using Mirror;

public class MultiplayerMenuUI : MonoBehaviour
{
    [Header("UI Panels")]
    [SerializeField] private GameObject gameMenuPanel;
    [SerializeField] private NetworkGameManager networkGameManager;

    private bool menuVisible = false;

    private void Start()
    {
        ResolveDependencies();
        HideMenu();
    }

    private void Update()
    {
        bool sessionActive = NetworkClient.isConnected || NetworkServer.active;
        if (!sessionActive)
        {
            if (menuVisible)
            {
                HideMenu();
            }

            return;
        }

        if (Input.GetKeyDown(KeyCode.Escape))
        {
            ToggleMenu();
        }
    }

    public void ToggleMenu()
    {
        if (gameMenuPanel == null)
        {
            return;
        }

        menuVisible = !menuVisible;
        gameMenuPanel.SetActive(menuVisible);
    }

    public void HideMenu()
    {
        if (gameMenuPanel == null)
        {
            return;
        }

        gameMenuPanel.SetActive(false);
        menuVisible = false;
    }

    public void OnResetClicked()
    {
        ResolveDependencies();

        if (!NetworkClient.isConnected)
        {
            Debug.LogWarning("[UI] Not connected to a game");
            HideMenu();
            return;
        }

        SimplePlayerMovement localPlayer = NetworkClient.localPlayer != null
            ? NetworkClient.localPlayer.GetComponent<SimplePlayerMovement>()
            : null;

        if (networkGameManager != null && localPlayer != null)
        {
            networkGameManager.RequestSessionReset(localPlayer);
            Debug.Log("[UI] Requested a local player reset.");
        }
        else
        {
            Debug.LogWarning("[UI] Could not find the local player to reset.");
        }

        HideMenu();
    }

    public void OnReturnToLobbyClicked()
    {
        HideMenu();

        if (!NetworkClient.isConnected && !NetworkServer.active)
        {
            Debug.LogWarning("[UI] No active session to leave.");
            return;
        }

        ResolveDependencies();
        if (networkGameManager != null)
        {
            networkGameManager.RequestReturnToLobby();
        }
        else
        {
            NetworkManager.singleton?.StopClient();
        }
    }

    private void OnDisable()
    {
        HideMenu();
    }

    private void ResolveDependencies()
    {
        if (networkGameManager == null)
        {
            networkGameManager = NetworkGameManager.Instance != null
                ? NetworkGameManager.Instance
                : FindFirstObjectByType<NetworkGameManager>();
        }
    }
}
