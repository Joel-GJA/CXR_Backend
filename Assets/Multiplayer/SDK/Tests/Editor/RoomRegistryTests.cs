using NUnit.Framework;
using CXR.SDK.Rooms;

namespace CXR.SDK.Tests.Editor
{
    public sealed class RoomRegistryTests
    {
        [Test]
        public void Upsert_ReusesExistingRoomId()
        {
            var registry = new RoomRegistry();
            var room = new RoomInfo
            {
                RoomId = "room-a",
                RoomName = "Physics Lab",
                IpAddress = "192.168.1.20",
                Port = 7777
            };

            registry.Upsert(room, 1f);

            room.PlayerCount = 4;
            registry.Upsert(room, 2f);

            var storedRoom = registry.GetRoomById("room-a");

            Assert.NotNull(storedRoom);
            Assert.AreEqual(4, storedRoom.PlayerCount);
            Assert.AreEqual(2f, storedRoom.LastSeen);
        }

        [Test]
        public void Upsert_RemovesDuplicateEndpointEntries()
        {
            var registry = new RoomRegistry();

            registry.Upsert(new RoomInfo
            {
                RoomId = "room-a",
                RoomName = "Old Room",
                IpAddress = "192.168.1.21",
                Port = 7777
            }, 1f);

            registry.Upsert(new RoomInfo
            {
                RoomId = "room-b",
                RoomName = "New Room",
                IpAddress = "192.168.1.21",
                Port = 7777
            }, 2f);

            Assert.IsNull(registry.GetRoomById("room-a"));
            Assert.NotNull(registry.GetRoomById("room-b"));
            Assert.AreEqual(1, registry.GetRooms().Count);
        }

        [Test]
        public void CleanupStale_RemovesExpiredRooms()
        {
            var registry = new RoomRegistry();
            registry.Upsert(new RoomInfo
            {
                RoomId = "room-a",
                RoomName = "Chemistry Lab",
                IpAddress = "192.168.1.22",
                Port = 7777
            }, 1f);

            var removedCount = registry.CleanupStale(8f, 5f);

            Assert.AreEqual(1, removedCount);
            Assert.AreEqual(0, registry.GetRooms().Count);
        }
    }
}
