using System;
using System.Collections.Generic;
using CXR.SDK.Discovery;
using CXR.SDK.Rooms;

namespace CXR.SDK.Browser
{
    public sealed class SessionBrowser
    {
        private readonly DiscoveryManager discoveryManager;

        public SessionBrowser(DiscoveryManager manager)
        {
            discoveryManager = manager;
        }

        public event Action<IReadOnlyList<RoomInfo>> RoomsChanged
        {
            add => discoveryManager.RoomsChanged += value;
            remove => discoveryManager.RoomsChanged -= value;
        }

        public IReadOnlyList<RoomInfo> GetRooms()
        {
            return discoveryManager.GetRooms();
        }

        public RoomInfo GetRoomById(string roomId)
        {
            return discoveryManager.GetRoomById(roomId);
        }

        public void RefreshRooms()
        {
            discoveryManager.RefreshRooms();
        }

        public bool JoinRoom(string roomId, out string error)
        {
            return discoveryManager.JoinRoom(roomId, out error);
        }
    }
}
