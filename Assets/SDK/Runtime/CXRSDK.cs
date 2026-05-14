using System.Collections.Generic;
using UnityEngine;

namespace CXR.SDK
{
    public static class CXRSDK
    {
        private static Discovery.DiscoveryManager manager;

        public static bool IsInitialized => manager != null && manager.IsInitialized;

        public static Browser.SessionBrowser Browser => EnsureManager().Browser;

        public static void Initialize()
        {
            EnsureManager().Initialize();
        }

        public static void Shutdown()
        {
            if (manager == null)
            {
                return;
            }

            manager.Shutdown();
        }

        public static void RefreshRooms()
        {
            EnsureManager().RefreshRooms();
        }

        public static IReadOnlyList<Rooms.RoomInfo> GetRooms()
        {
            return EnsureManager().GetRooms();
        }

        public static Rooms.RoomInfo GetRoomById(string roomId)
        {
            return EnsureManager().GetRoomById(roomId);
        }

        public static bool JoinRoom(string roomId)
        {
            return EnsureManager().JoinRoom(roomId, out _);
        }

        public static bool JoinRoom(string roomId, out string error)
        {
            return EnsureManager().JoinRoom(roomId, out error);
        }

        internal static void RegisterManager(Discovery.DiscoveryManager discoveryManager)
        {
            if (discoveryManager == null)
            {
                return;
            }

            if (manager != null && manager != discoveryManager)
            {
                Utils.Logger.Warn("Replacing an existing DiscoveryManager registration.");
            }

            manager = discoveryManager;
        }

        internal static void UnregisterManager(Discovery.DiscoveryManager discoveryManager)
        {
            if (manager == discoveryManager)
            {
                manager = null;
            }
        }

        private static Discovery.DiscoveryManager EnsureManager()
        {
            if (manager != null)
            {
                return manager;
            }

            var existingManager = Object.FindObjectOfType<Discovery.DiscoveryManager>();
            if (existingManager != null)
            {
                RegisterManager(existingManager);
                return existingManager;
            }

            var rootObject = new GameObject("CXR SDK");
            Object.DontDestroyOnLoad(rootObject);
            var createdManager = rootObject.AddComponent<Discovery.DiscoveryManager>();
            RegisterManager(createdManager);
            return createdManager;
        }
    }
}
