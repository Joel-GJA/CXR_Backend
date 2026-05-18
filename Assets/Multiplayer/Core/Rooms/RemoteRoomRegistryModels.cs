using System;
using CXR.SDK.Rooms;

[Serializable]
public sealed class RemoteRoomRegistryEnvelope
{
    public RemoteRoomRecord[] rooms = Array.Empty<RemoteRoomRecord>();
}

[Serializable]
public sealed class RemoteRoomRecord
{
    public string roomId = string.Empty;
    public string roomName = "Remote Room";
    public string ipAddress = string.Empty;
    public int port = 7777;
    public int playerCount;
    public int maxPlayers = 1;
    public string status = "Open";
    public long lastSeenUnixMs;
    public RoomMetadataEntry[] metadata = Array.Empty<RoomMetadataEntry>();

    public static RemoteRoomRecord FromRoomInfo(RoomInfo room)
    {
        RemoteRoomRecord record = new RemoteRoomRecord();
        if (room == null)
        {
            return record;
        }

        record.roomId = room.RoomId;
        record.roomName = room.RoomName;
        record.ipAddress = room.IpAddress;
        record.port = room.Port;
        record.playerCount = room.PlayerCount;
        record.maxPlayers = room.MaxPlayers;
        record.status = room.Status;

        if (room.Metadata != null)
        {
            record.metadata = new RoomMetadataEntry[room.Metadata.Count];
            for (int index = 0; index < room.Metadata.Count; index++)
            {
                record.metadata[index] = room.Metadata[index];
            }
        }

        return record;
    }

    public RoomInfo ToRoomInfo()
    {
        RoomInfo room = new RoomInfo
        {
            RoomId = roomId,
            RoomName = roomName,
            IpAddress = ipAddress,
            Port = port,
            PlayerCount = playerCount,
            MaxPlayers = maxPlayers,
            Status = status
        };

        room.ReplaceMetadata(metadata);
        return room;
    }
}
