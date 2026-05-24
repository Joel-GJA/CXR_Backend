using System;
using System.Collections.Generic;
using UnityEngine;

namespace CXR.SDK.Rooms
{
    [Serializable]
    public sealed class RoomInfo
    {
        [SerializeField] private string roomId = string.Empty;
        [SerializeField] private string roomName = "LAN Room";
        [SerializeField] private int playerCount;
        [SerializeField] private int maxPlayers = 1;
        [SerializeField] private string status = "Open";
        [SerializeField] private string ipAddress = string.Empty;
        [SerializeField] private int port = 7777;
        [SerializeField] private float lastSeen;
        [SerializeField] private RoomState state = RoomState.Unknown;
        [SerializeField] private List<RoomMetadataEntry> metadata = new List<RoomMetadataEntry>();

        public string RoomId
        {
            get => roomId;
            set => roomId = value ?? string.Empty;
        }

        public string RoomName
        {
            get => roomName;
            set => roomName = string.IsNullOrWhiteSpace(value) ? "LAN Room" : value;
        }

        public int PlayerCount
        {
            get => playerCount;
            set => playerCount = Mathf.Max(0, value);
        }

        public int MaxPlayers
        {
            get => maxPlayers;
            set => maxPlayers = Mathf.Max(1, value);
        }

        public string Status
        {
            get => status;
            set => status = string.IsNullOrWhiteSpace(value) ? "Open" : value;
        }

        public string IpAddress
        {
            get => ipAddress;
            set => ipAddress = value ?? string.Empty;
        }

        public int Port
        {
            get => port;
            set => port = Mathf.Max(0, value);
        }

        public float LastSeen
        {
            get => lastSeen;
            internal set => lastSeen = value;
        }

        public RoomState State
        {
            get => state;
            internal set => state = value;
        }

        public IReadOnlyList<RoomMetadataEntry> Metadata => metadata;

        public string EndpointKey => string.Concat(IpAddress, ":", Port.ToString());

        public void ReplaceMetadata(IEnumerable<RoomMetadataEntry> entries)
        {
            metadata.Clear();

            if (entries == null)
            {
                return;
            }

            foreach (var entry in entries)
            {
                metadata.Add(new RoomMetadataEntry(entry.Key, entry.Value));
            }
        }

        public string GetMetadataValue(string key, string fallback = "")
        {
            if (string.IsNullOrWhiteSpace(key))
            {
                return fallback;
            }

            for (var index = 0; index < metadata.Count; index++)
            {
                if (string.Equals(metadata[index].Key, key, StringComparison.OrdinalIgnoreCase))
                {
                    return metadata[index].Value;
                }
            }

            return fallback;
        }

        public RoomInfo Clone()
        {
            var clone = new RoomInfo
            {
                RoomId = RoomId,
                RoomName = RoomName,
                PlayerCount = PlayerCount,
                MaxPlayers = MaxPlayers,
                Status = Status,
                IpAddress = IpAddress,
                Port = Port,
                LastSeen = LastSeen,
                State = State
            };

            clone.ReplaceMetadata(metadata);
            return clone;
        }
    }
}
