using System;
using UnityEngine;
using UnityEngine.UI;
using CXR.SDK.Rooms;

namespace CXR.SDK.Samples.RoomBrowserExample
{
    public sealed class SampleRoomListItemView : MonoBehaviour
    {
        [SerializeField] private Text roomNameText;
        [SerializeField] private Text detailsText;
        [SerializeField] private Button joinButton;

        private RoomInfo boundRoom;
        private Action<RoomInfo> joinAction;

        public void Bind(RoomInfo room, Action<RoomInfo> onJoin)
        {
            boundRoom = room;
            joinAction = onJoin;

            if (roomNameText != null)
            {
                roomNameText.text = room.RoomName;
            }

            if (detailsText != null)
            {
                detailsText.text = room.PlayerCount + "/" + room.MaxPlayers + " players  |  " +
                                   room.Status + "  |  " +
                                   room.IpAddress + ":" + room.Port;
            }

            if (joinButton != null)
            {
                joinButton.onClick.RemoveListener(HandleJoinClicked);
                joinButton.onClick.AddListener(HandleJoinClicked);
            }
        }

        private void HandleJoinClicked()
        {
            joinAction?.Invoke(boundRoom);
        }
    }
}
