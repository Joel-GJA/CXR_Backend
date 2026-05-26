using UnityEngine;

public class WristMenuController : MonoBehaviour
{
    [SerializeField]
    private XRMultiplayerRuntimeFacade runtimeFacade;

    [SerializeField]
    private ConnectionPanelController connectionPanel;

    [SerializeField]
    private RegistryPanelController registryPanel;

    [SerializeField]
    private RoomsPanelController roomsPanel;

    [SerializeField]
    private debugPanelController debugPanel;

    private void Awake()
    {
        InitializePanels();
    }
    private void HideAll()
    {
        connectionPanel.gameObject.SetActive(false);
        registryPanel.gameObject.SetActive(false);
        roomsPanel.gameObject.SetActive(false);
        debugPanel.gameObject.SetActive(false);
    }

    public void ShowConnection()
    {
        HideAll();
        connectionPanel.gameObject.SetActive(true);
    }

    public void ShowRegistry()
    {
        HideAll();
        registryPanel.gameObject.SetActive(true);
    }

    public void ShowRooms()
    {
        HideAll();
        roomsPanel.gameObject.SetActive(true);
    }

    public void ShowDebug()
    {
        HideAll();
        debugPanel.gameObject.SetActive(true);
    }

    public void SetRuntimeFacade(XRMultiplayerRuntimeFacade facade)
    {
        runtimeFacade = facade;
        InitializePanels();
    }

    private void InitializePanels()
    {
        if (runtimeFacade == null)
        {
            Debug.LogWarning(
                "[WRIST MENU] Runtime facade is not assigned. " +
                "Inject it through WristMenuController.SetRuntimeFacade.");
        }

        if (connectionPanel != null)
            connectionPanel.Initialize(runtimeFacade);

        if (registryPanel != null)
            registryPanel.Initialize(runtimeFacade);

        if (roomsPanel != null)
            roomsPanel.Initialize(runtimeFacade);

        if (debugPanel != null)
            debugPanel.Initialize(runtimeFacade);
    }
}
