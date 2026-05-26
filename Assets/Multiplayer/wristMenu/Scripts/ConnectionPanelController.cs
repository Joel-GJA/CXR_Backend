using TMPro;
using UnityEngine;
using UnityEngine.UI;

public class ConnectionPanelController : RuntimeFacadePanel
{
    [Header("UI")]
    [SerializeField]
    private TMP_Text stateValue;

    [SerializeField]
    private TMP_InputField addressInput;

    [SerializeField]
    private Button hostButton;

    [SerializeField]
    private Button serverButton;

    [SerializeField]
    private Button clientButton;

    [SerializeField]
    private Button stopButton;

    private void Start()
    {
        hostButton.onClick.AddListener(OnHostClicked);
        serverButton.onClick.AddListener(OnServerClicked);
        clientButton.onClick.AddListener(OnClientClicked);
        stopButton.onClick.AddListener(OnStopClicked);
    }
    
    public override void Initialize(XRMultiplayerRuntimeFacade facade)
    {
        runtimeFacade = facade;
    }
    private void Update()
    {
        if (runtimeFacade == null)
            return;

        stateValue.text =
            runtimeFacade.ConnectionState.ToString();
    }

    private void OnHostClicked()
    {
        runtimeFacade.StartHost();
    }

    private void OnServerClicked()
    {
        runtimeFacade.StartServer();
    }

    private void OnClientClicked()
    {
        runtimeFacade.StartClient(addressInput.text);
    }

    private void OnStopClicked()
    {
        runtimeFacade.Stop();
    }
}
