using System;
using System.Collections.Generic;

namespace CXR.SDK.Rooms
{
    public sealed class RoomRegistry
    {
        private readonly Dictionary<string, RoomInfo> roomsById = new Dictionary<string, RoomInfo>(StringComparer.OrdinalIgnoreCase);
        private readonly Dictionary<string, string> roomIdByEndpoint = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        public event Action RegistryChanged;

        public IReadOnlyList<RoomInfo> GetRooms()
        {
            var rooms = new List<RoomInfo>(roomsById.Count);

            foreach (var room in roomsById.Values)
            {
                rooms.Add(room.Clone());
            }

            rooms.Sort(CompareRooms);
            return rooms;
        }

        public RoomInfo GetRoomById(string roomId)
        {
            if (string.IsNullOrWhiteSpace(roomId))
            {
                return null;
            }

            return roomsById.TryGetValue(roomId, out var room) ? room.Clone() : null;
        }

        public bool Upsert(RoomInfo incomingRoom, float seenAt)
        {
            if (incomingRoom == null)
            {
                return false;
            }

            incomingRoom.LastSeen = seenAt;
            incomingRoom.State = RoomState.Visible;

            var identityKey = GetIdentityKey(incomingRoom);
            var endpointKey = incomingRoom.EndpointKey;

            if (!string.IsNullOrWhiteSpace(endpointKey) &&
                roomIdByEndpoint.TryGetValue(endpointKey, out var endpointRoomId) &&
                !string.Equals(endpointRoomId, identityKey, StringComparison.OrdinalIgnoreCase))
            {
                Remove(endpointRoomId);
            }

            if (roomsById.TryGetValue(identityKey, out var existingRoom))
            {
                var oldEndpointKey = existingRoom.EndpointKey;
                Copy(incomingRoom, existingRoom);

                if (!string.Equals(oldEndpointKey, endpointKey, StringComparison.OrdinalIgnoreCase) &&
                    !string.IsNullOrWhiteSpace(oldEndpointKey))
                {
                    roomIdByEndpoint.Remove(oldEndpointKey);
                }

                if (!string.IsNullOrWhiteSpace(endpointKey))
                {
                    roomIdByEndpoint[endpointKey] = identityKey;
                }

                RegistryChanged?.Invoke();
                return true;
            }

            var createdRoom = incomingRoom.Clone();
            roomsById[identityKey] = createdRoom;

            if (!string.IsNullOrWhiteSpace(endpointKey))
            {
                roomIdByEndpoint[endpointKey] = identityKey;
            }

            RegistryChanged?.Invoke();
            return true;
        }

        public int CleanupStale(float now, float staleTimeoutSeconds)
        {
            var removedCount = 0;
            var staleRoomIds = new List<string>();

            foreach (var pair in roomsById)
            {
                if (now - pair.Value.LastSeen >= staleTimeoutSeconds)
                {
                    staleRoomIds.Add(pair.Key);
                }
            }

            for (var index = 0; index < staleRoomIds.Count; index++)
            {
                if (Remove(staleRoomIds[index]))
                {
                    removedCount++;
                }
            }

            return removedCount;
        }

        public void Clear()
        {
            if (roomsById.Count == 0)
            {
                return;
            }

            roomsById.Clear();
            roomIdByEndpoint.Clear();
            RegistryChanged?.Invoke();
        }

        private bool Remove(string roomId)
        {
            if (string.IsNullOrWhiteSpace(roomId) || !roomsById.TryGetValue(roomId, out var room))
            {
                return false;
            }

            roomsById.Remove(roomId);

            if (!string.IsNullOrWhiteSpace(room.EndpointKey))
            {
                roomIdByEndpoint.Remove(room.EndpointKey);
            }

            RegistryChanged?.Invoke();
            return true;
        }

        private static void Copy(RoomInfo source, RoomInfo destination)
        {
            destination.RoomId = source.RoomId;
            destination.RoomName = source.RoomName;
            destination.PlayerCount = source.PlayerCount;
            destination.MaxPlayers = source.MaxPlayers;
            destination.Status = source.Status;
            destination.IpAddress = source.IpAddress;
            destination.Port = source.Port;
            destination.LastSeen = source.LastSeen;
            destination.State = source.State;
            destination.ReplaceMetadata(source.Metadata);
        }

        private static string GetIdentityKey(RoomInfo room)
        {
            if (!string.IsNullOrWhiteSpace(room.RoomId))
            {
                return room.RoomId;
            }

            return room.EndpointKey;
        }

        private static int CompareRooms(RoomInfo left, RoomInfo right)
        {
            var statusComparison = string.Compare(left.Status, right.Status, StringComparison.OrdinalIgnoreCase);
            if (statusComparison != 0)
            {
                return statusComparison;
            }

            return string.Compare(left.RoomName, right.RoomName, StringComparison.OrdinalIgnoreCase);
        }
    }
}
