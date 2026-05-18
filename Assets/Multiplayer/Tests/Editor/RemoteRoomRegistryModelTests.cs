using CXR.SDK.Rooms;
using NUnit.Framework;

public sealed class RemoteRoomRegistryModelTests
{
    [Test]
    public void RemoteRoomRecord_RoundTripsRoomInfo()
    {
        RoomInfo room = new RoomInfo
        {
            RoomId = "room-a",
            RoomName = "Room A",
            IpAddress = "203.0.113.10",
            Port = 7777,
            PlayerCount = 2,
            MaxPlayers = 8,
            Status = "Open"
        };

        room.ReplaceMetadata(
            new[]
            {
                new RoomMetadataEntry("room", "A"),
                new RoomMetadataEntry("serverMode", "Dedicated")
            });

        RemoteRoomRecord record = RemoteRoomRecord.FromRoomInfo(room);
        RoomInfo roundTripped = record.ToRoomInfo();

        Assert.AreEqual(room.RoomId, roundTripped.RoomId);
        Assert.AreEqual(room.RoomName, roundTripped.RoomName);
        Assert.AreEqual(room.IpAddress, roundTripped.IpAddress);
        Assert.AreEqual(room.Port, roundTripped.Port);
        Assert.AreEqual(room.PlayerCount, roundTripped.PlayerCount);
        Assert.AreEqual(room.MaxPlayers, roundTripped.MaxPlayers);
        Assert.AreEqual("A", roundTripped.GetMetadataValue("room"));
        Assert.AreEqual(
            "Dedicated",
            roundTripped.GetMetadataValue("serverMode"));
    }
}
