using Mirror;
using CXR.SDK.Rooms;

namespace CXR.SDK.Discovery
{
    public struct CXRDiscoveryRequest : NetworkMessage
    {
        public int ProtocolVersion;
    }

    public struct CXRDiscoveryResponse : NetworkMessage
    {
        public int ProtocolVersion;
        public string RoomId;
        public string RoomName;
        public int PlayerCount;
        public int MaxPlayers;
        public string Status;
        public string IpAddress;
        public int Port;
        public long ServerInstanceId;
        public RoomMetadataEntry[] Metadata;
    }
}
