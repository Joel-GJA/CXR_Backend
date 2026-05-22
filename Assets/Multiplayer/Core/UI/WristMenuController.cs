using UnityEngine;

public class WristMenuController : MonoBehaviour
{
    [SerializeField]
    private GameObject connectionPanel;

    [SerializeField]
    private GameObject registryPanel;

    [SerializeField]
    private GameObject roomsPanel;

    [SerializeField]
    private GameObject debugPanel;

    private void HideAll()
    {
        connectionPanel.SetActive(false);
        registryPanel.SetActive(false);
        roomsPanel.SetActive(false);
        debugPanel.SetActive(false);
    }

    public void ShowConnection()
    {
        HideAll();
        connectionPanel.SetActive(true);
    }

    public void ShowRegistry()
    {
        HideAll();
        registryPanel.SetActive(true);
    }

    public void ShowRooms()
    {
        HideAll();
        roomsPanel.SetActive(true);
    }

    public void ShowDebug()
    {
        HideAll();
        debugPanel.SetActive(true);
    }
}