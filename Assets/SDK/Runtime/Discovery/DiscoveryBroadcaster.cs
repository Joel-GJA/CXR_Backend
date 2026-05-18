using System;
using Mirror;
using UnityEngine;
using CXR.SDK.Rooms;
using CXR.SDK.Utils;

namespace CXR.SDK.Discovery
{
    [AddComponentMenu("CXR SDK/Discovery/Discovery Broadcaster")]
    [DisallowMultipleComponent]
    public sealed class DiscoveryBroadcaster : MonoBehaviour
    {
        [SerializeField] private DiscoveryListener listener;
        [SerializeField] private string roomId = string.Empty;
        [SerializeField] private string roomName = "LAN Room";
        [SerializeField] private string status = "Open";
        [SerializeField] private int maxPlayers = 16;
        [SerializeField] private bool useExplicitPlayerCount;
        [SerializeField] private int explicitPlayerCount;
        [SerializeField] private int explicitPort;
        [SerializeField] private bool requireServerActive = true;
        [SerializeField] private bool autoAdvertise = true;
        [SerializeField] private float advertiseIntervalSeconds = 1.5f;
        [SerializeField] private RoomMetadataEntry[] defaultMetadata = Array.Empty<RoomMetadataEntry>();

        private readonly RoomMetadataManager metadataManager = new RoomMetadataManager();
        private long serverInstanceId;
        private float nextAdvertiseTime;

        public string RoomId => roomId;

        public string RoomName
        {
            get => roomName;
            set => roomName = string.IsNullOrWhiteSpace(value) ? "LAN Room" : value;
        }

        public string Status
        {
            get => status;
            set => status = string.IsNullOrWhiteSpace(value) ? "Open" : value;
        }

        public int MaxPlayers
        {
            get => maxPlayers;
            set => maxPlayers = Mathf.Max(1, value);
        }

        public int ExplicitPort
        {
            get => explicitPort;
            set => explicitPort = Mathf.Max(0, value);
        }

        public bool RequireServerActive
        {
            get => requireServerActive;
            set => requireServerActive = value;
        }

        private void Awake()
        {
            if (listener == null)
            {
                listener = GetComponent<DiscoveryListener>();
            }

            if (string.IsNullOrWhiteSpace(roomId))
            {
                roomId = Guid.NewGuid().ToString("N");
            }

            serverInstanceId = BitConverter.ToInt64(Guid.NewGuid().ToByteArray(), 0);
            metadataManager.ApplyDefaults(defaultMetadata);
        }

        private void OnEnable()
        {
            if (listener != null)
            {
                listener.SetBroadcaster(this);
            }
        }

        private void Update()
        {
            if (!autoAdvertise || listener == null)
            {
                return;
            }

            if (requireServerActive && !NetworkServer.active)
            {
                return;
            }

            if (Time.unscaledTime < nextAdvertiseTime)
            {
                return;
            }

            nextAdvertiseTime = Time.unscaledTime + Mathf.Max(0.25f, advertiseIntervalSeconds);
            listener.BroadcastRoom();
        }

        public void SetMetadata(string key, string value)
        {
            metadataManager.Set(key, value);
        }

        public bool RemoveMetadata(string key)
        {
            return metadataManager.Remove(key);
        }

        public void SetPlayerCountOverride(int playerCount)
        {
            explicitPlayerCount = Mathf.Max(0, playerCount);
            useExplicitPlayerCount = true;
        }

        public void ClearPlayerCountOverride()
        {
            explicitPlayerCount = 0;
            useExplicitPlayerCount = false;
        }

        public bool TryBuildResponse(out CXRDiscoveryResponse response)
        {
            response = default;

            if (requireServerActive && !NetworkServer.active)
            {
                return false;
            }

            response = new CXRDiscoveryResponse
            {
                RoomId = roomId,
                RoomName = RoomName,
                PlayerCount = ResolvePlayerCount(),
                MaxPlayers = Mathf.Max(1, maxPlayers),
                Status = Status,
                IpAddress = string.Empty,
                Port = ResolvePort(),
                ServerInstanceId = serverInstanceId,
                Metadata = metadataManager.ToArray()
            };

            return response.Port > 0;
        }

        private int ResolvePlayerCount()
        {
            if (useExplicitPlayerCount)
            {
                return explicitPlayerCount;
            }

            if (!NetworkServer.active || NetworkServer.connections == null)
            {
                return 0;
            }

            var count = 0;
            foreach (var pair in NetworkServer.connections)
            {
                if (pair.Value != null && pair.Value.isAuthenticated)
                {
                    count++;
                }
            }

            return count;
        }

        private int ResolvePort()
        {
            if (explicitPort > 0)
            {
                return explicitPort;
            }

            var activeTransport = Transport.active;
            if (activeTransport == null)
            {
                CXRLogger.Warn("No active Mirror transport was found while building a room advertisement.");
                return 0;
            }

            var transportType = activeTransport.GetType();
            var property = transportType.GetProperty("Port") ?? transportType.GetProperty("port");
            if (property != null && property.CanRead)
            {
                return Convert.ToInt32(property.GetValue(activeTransport));
            }

            var field = transportType.GetField("Port") ?? transportType.GetField("port");
            if (field != null)
            {
                return Convert.ToInt32(field.GetValue(activeTransport));
            }

            CXRLogger.Warn("Unable to resolve the active transport port. Set an explicit port on DiscoveryBroadcaster.");
            return 0;
        }
    }
}
