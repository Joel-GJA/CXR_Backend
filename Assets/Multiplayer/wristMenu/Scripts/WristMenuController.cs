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
        if (runtimeFacade == null)
            runtimeFacade = FindObjectOfType<XRMultiplayerRuntimeFacade>();

        connectionPanel.Initialize(runtimeFacade);
        registryPanel.Initialize(runtimeFacade);
        roomsPanel.Initialize(runtimeFacade);
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
        connectionPanel.Initialize(facade);
        registryPanel.Initialize(facade);
        roomsPanel.Initialize(facade);
    }
}