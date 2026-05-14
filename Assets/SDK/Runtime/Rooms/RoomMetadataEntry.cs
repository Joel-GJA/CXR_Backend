using System;

namespace CXR.SDK.Rooms
{
    [Serializable]
    public struct RoomMetadataEntry
    {
        public string Key;
        public string Value;

        public RoomMetadataEntry(string key, string value)
        {
            Key = key ?? string.Empty;
            Value = value ?? string.Empty;
        }
    }
}
