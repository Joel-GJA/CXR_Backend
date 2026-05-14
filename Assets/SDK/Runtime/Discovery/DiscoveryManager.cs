using System;
using System.Collections.Generic;
using System.Net;
using UnityEngine;
using CXR.SDK.Browser;
using CXR.SDK.Networking;
using CXR.SDK.Rooms;
using CXR.SDK.Utils;

namespace CXR.SDK.Discovery
{
    [AddComponentMenu("CXR SDK/Discovery/Discovery Manager")]
    [DisallowMultipleComponent]
    public sealed class DiscoveryManager : MonoBehaviour
    {
        [SerializeField] private DiscoveryListener discoveryListener;
        [SerializeField] private JoinRoomHandler joinRoomHandler;
        [SerializeField] private bool initializeOnAwake = true;
        [SerializeField] private bool autoRefresh = true;
        [SerializeField] private bool refreshImmediately = true;
        [SerializeField] private float refreshIntervalSeconds = 2f;
        [SerializeField] private float staleTimeoutSeconds = 5f;
        [SerializeField] private float cleanupIntervalSeconds = 1f;
        [SerializeField] private bool verboseLogging;

        private readonly RoomRegistry roomRegistry = new RoomRegistry();
        private float nextRefreshTime;
        private float nextCleanupTime;
        private bool isInitialized;

        public event Action<IReadOnlyList<RoomInfo>> RoomsChanged;

        public bool IsInitialized => isInitialized;

        public SessionBrowser Browser { get; private set; }

        public RoomRegistry Registry => roomRegistry;

        private void Awake()
        {
            EnsureDependencies();
            Browser = new SessionBrowser(this);
            CXRSDK.RegisterManager(this);

            if (initializeOnAwake)
            {
                Initialize();
            }
        }

        private void OnDestroy()
        {
            Shutdown();
            CXRSDK.UnregisterManager(this);
        }

        private void Update()
        {
            if (!isInitialized)
            {
                return;
            }

            var now = Time.unscaledTime;

            if (autoRefresh && now >= nextRefreshTime)
            {
                RefreshRooms();
            }

            if (now >= nextCleanupTime)
            {
                CleanupStaleRooms(now);
            }
        }

        public void Initialize()
        {
            if (isInitialized)
            {
                return;
            }

            EnsureDependencies();

            Logger.VerboseLogging = verboseLogging;
            discoveryListener.RoomDiscovered += HandleRoomDiscovered;
            roomRegistry.RegistryChanged += HandleRegistryChanged;

            isInitialized = true;
            nextRefreshTime = Time.unscaledTime;
            nextCleanupTime = Time.unscaledTime + Mathf.Max(0.25f, cleanupIntervalSeconds);

            if (refreshImmediately)
            {
                RefreshRooms();
            }
        }

        public void Shutdown()
        {
            if (!isInitialized)
            {
                return;
            }

            isInitialized = false;

            if (discoveryListener != null)
            {
                discoveryListener.RoomDiscovered -= HandleRoomDiscovered;
                discoveryListener.StopRoomDiscovery();
            }

            roomRegistry.RegistryChanged -= HandleRegistryChanged;
            roomRegistry.Clear();
        }

        public void RefreshRooms()
        {
            EnsureDependencies();
            discoveryListener.RequestRoomRefresh();
            nextRefreshTime = Time.unscaledTime + Mathf.Max(0.25f, refreshIntervalSeconds);
            Logger.Info("Requested LAN room refresh.");
        }

        public IReadOnlyList<RoomInfo> GetRooms()
        {
            return roomRegistry.GetRooms();
        }

        public RoomInfo GetRoomById(string roomId)
        {
            return roomRegistry.GetRoomById(roomId);
        }

        public bool JoinRoom(string roomId, out string error)
        {
            var room = roomRegistry.GetRoomById(roomId);
            if (room == null)
            {
                error = "The requested room could not be found in the registry.";
                return false;
            }

            if (discoveryListener != null)
            {
                discoveryListener.StopRoomDiscovery();
            }

            var joined = joinRoomHandler.TryJoin(room, out error);
            if (!joined)
            {
                return false;
            }

            Logger.Info("Join workflow initiated for room " + room.RoomName + ".");
            return true;
        }

        private void EnsureDependencies()
        {
            if (discoveryListener == null)
            {
                discoveryListener = GetComponent<DiscoveryListener>();
            }

            if (discoveryListener == null)
            {
                discoveryListener = gameObject.AddComponent<DiscoveryListener>();
            }

            if (joinRoomHandler == null)
            {
                joinRoomHandler = GetComponent<JoinRoomHandler>();
            }

            if (joinRoomHandler == null)
            {
                joinRoomHandler = gameObject.AddComponent<JoinRoomHandler>();
            }
        }

        private void HandleRoomDiscovered(CXRDiscoveryResponse response, IPEndPoint endpoint)
        {
            var room = new RoomInfo
            {
                RoomId = response.RoomId,
                RoomName = response.RoomName,
                PlayerCount = response.PlayerCount,
                MaxPlayers = response.MaxPlayers,
                Status = response.Status,
                IpAddress = string.IsNullOrWhiteSpace(response.IpAddress) ? endpoint.Address.ToString() : response.IpAddress,
                Port = response.Port,
                State = RoomState.Visible
            };

            room.ReplaceMetadata(response.Metadata);
            roomRegistry.Upsert(room, Time.unscaledTime);
        }

        private void CleanupStaleRooms(float now)
        {
            nextCleanupTime = now + Mathf.Max(0.25f, cleanupIntervalSeconds);
            var removedCount = roomRegistry.CleanupStale(now, Mathf.Max(1f, staleTimeoutSeconds));

            if (removedCount > 0)
            {
                Logger.Info("Removed " + removedCount + " stale room entries.");
            }
        }

        private void HandleRegistryChanged()
        {
            RoomsChanged?.Invoke(roomRegistry.GetRooms());
        }
    }
}
