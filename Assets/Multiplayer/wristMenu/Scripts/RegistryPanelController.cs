using TMPro;
using UnityEngine;
using UnityEngine.UI;

public class RegistryPanelController : RuntimeFacadePanel
{
    private const string RegistryKey = "VRRegistryUrl";

    [Header("UI")]
    [SerializeField]
    private TMP_InputField urlInput;

    [SerializeField]
    private TMP_Text configuredValue;

    [SerializeField]
    private TMP_Text remoteRoomsValue;

    [SerializeField]
    private TMP_Text refreshValue;

    [SerializeField]
    private TMP_Text httpValue;

    [SerializeField]
    private Button applyButton;

    [SerializeField]
    private Button refreshButton;

    [SerializeField]
    private Button advertiseButton;

    private void Start()
    {
        applyButton.onClick.AddListener(OnApplyClicked);
        refreshButton.onClick.AddListener(OnRefreshClicked);
        advertiseButton.onClick.AddListener(OnAdvertiseClicked);

        string defaultUrl =
            runtimeFacade != null
                ? runtimeFacade.RemoteRegistryUrl
                : "http://127.0.0.1:8080";

        urlInput.text =
            PlayerPrefs.GetString(
                RegistryKey,
                defaultUrl);
    }

    private void Update()
    {
        if (runtimeFacade == null)
            return;

        configuredValue.text =
            runtimeFacade.IsRemoteRegistryAvailable
                ? "Yes"
                : "No";

        remoteRoomsValue.text =
            runtimeFacade.RemoteRoomCount.ToString();

        refreshValue.text =
            FormatTime(
                runtimeFacade.RemoteRegistryLastRefreshTime);

        httpValue.text =
            FormatHttp(
                runtimeFacade.RemoteRegistryLastResponseCode,
                runtimeFacade.RemoteRegistryLastResponseBytes);
    }

    private void OnApplyClicked()
    {
        if (runtimeFacade == null)
            return;

        runtimeFacade.RemoteRegistryUrl =
            urlInput.text;

        SaveRegistryUrl();
    }

    private void OnRefreshClicked()
    {
        if (runtimeFacade == null)
            return;

        runtimeFacade.RemoteRegistryUrl =
            urlInput.text;

        SaveRegistryUrl();

        runtimeFacade.RefreshRemoteRooms();
    }

    private void OnAdvertiseClicked()
    {
        if (runtimeFacade == null)
            return;

        runtimeFacade.RemoteRegistryUrl =
            urlInput.text;

        SaveRegistryUrl();

        runtimeFacade.PublishRoomToRegistry();
    }

    private void SaveRegistryUrl()
    {
        PlayerPrefs.SetString(
            RegistryKey,
            urlInput.text);

        PlayerPrefs.Save();
    }

    private string FormatTime(float time)
    {
        return time < 0f
            ? "never"
            : time.ToString("0.00") + "s";
    }

    private string FormatHttp(
        long responseCode,
        int bytes)
    {
        return responseCode < 0
            ? "none"
            : $"{responseCode} ({bytes} bytes)";
    }
}
