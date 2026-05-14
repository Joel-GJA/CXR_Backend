using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using CXR.SDK;
using CXR.SDK.Rooms;

namespace CXR.SDK.Samples.RoomBrowserExample
{
    public sealed class SampleRoomBrowserUI : MonoBehaviour
    {
        [SerializeField] private Transform roomListRoot;
        [SerializeField] private SampleRoomListItemView roomListItemPrefab;
        [SerializeField] private Text statusText;
        [SerializeField] private Button refreshButton;

        private readonly List<SampleRoomListItemView> activeItems = new List<SampleRoomListItemView>();

        private void OnEnable()
        {
            CXRSDK.Initialize();
            CXRSDK.Browser.RoomsChanged += HandleRoomsChanged;

            if (refreshButton != null)
            {
                refreshButton.onClick.AddListener(HandleRefreshClicked);
            }

            Redraw(CXRSDK.GetRooms());
        }

        private void OnDisable()
        {
            if (CXRSDK.IsInitialized)
            {
                CXRSDK.Browser.RoomsChanged -= HandleRoomsChanged;
            }

            if (refreshButton != null)
            {
                refreshButton.onClick.RemoveListener(HandleRefreshClicked);
            }
        }

        private void HandleRefreshClicked()
        {
            SetStatus("Refreshing LAN rooms...");
            CXRSDK.RefreshRooms();
        }

        private void HandleRoomsChanged(IReadOnlyList<RoomInfo> rooms)
        {
            Redraw(rooms);
        }

        private void Redraw(IReadOnlyList<RoomInfo> rooms)
        {
            ClearItems();

            if (rooms == null || rooms.Count == 0)
            {
                SetStatus("No LAN rooms detected.");
                return;
            }

            for (var index = 0; index < rooms.Count; index++)
            {
                var item = Instantiate(roomListItemPrefab, roomListRoot);
                item.Bind(rooms[index], HandleJoinRequested);
                activeItems.Add(item);
            }

            SetStatus("Detected " + rooms.Count + " LAN room(s).");
        }

        private void HandleJoinRequested(RoomInfo room)
        {
            if (room == null)
            {
                return;
            }

            if (CXRSDK.JoinRoom(room.RoomId, out var error))
            {
                SetStatus("Joining " + room.RoomName + "...");
                return;
            }

            SetStatus("Join failed: " + error);
        }

        private void ClearItems()
        {
            for (var index = 0; index < activeItems.Count; index++)
            {
                if (activeItems[index] != null)
                {
                    Destroy(activeItems[index].gameObject);
                }
            }

            activeItems.Clear();
        }

        private void SetStatus(string message)
        {
            if (statusText != null)
            {
                statusText.text = message;
            }
        }
    }
}
