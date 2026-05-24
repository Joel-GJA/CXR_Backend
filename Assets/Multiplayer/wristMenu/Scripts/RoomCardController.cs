using CXR.SDK.Rooms;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

public class RoomCardController : MonoBehaviour
{
    [SerializeField]
    private TMP_Text roomName;

    [SerializeField]
    private TMP_Text playerCount;

    [SerializeField]
    private TMP_Text statusText;

    [SerializeField]
    private Button joinButton;

    private RoomInfo room;
    private XRMultiplayerRuntimeFacade runtimeFacade;

    public void Initialize(
        RoomInfo roomInfo,
        XRMultiplayerRuntimeFacade facade)
    {
        room = roomInfo;
        runtimeFacade = facade;

        roomName.text =
            room.RoomName;

        playerCount.text =
            $"{room.PlayerCount}/{room.MaxPlayers} Players";

        statusText.text =
            $"Status: {room.Status}";

        joinButton.onClick.RemoveAllListeners();
        joinButton.onClick.AddListener(JoinRoom);
    }

    private void JoinRoom()
    {
        if (runtimeFacade == null)
            return;

        bool success =
            runtimeFacade.JoinRoom(
                room.RoomId,
                out string error);

        if (!success)
        {
            Debug.LogWarning(
                $"Failed to join room: {error}");
        }
    }
}