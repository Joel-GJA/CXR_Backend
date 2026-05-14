using System;
using System.Collections.Generic;

namespace CXR.SDK.Rooms
{
    public sealed class RoomMetadataManager
    {
        private readonly Dictionary<string, string> values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        public void ApplyDefaults(IEnumerable<RoomMetadataEntry> entries)
        {
            values.Clear();

            if (entries == null)
            {
                return;
            }

            foreach (var entry in entries)
            {
                Set(entry.Key, entry.Value);
            }
        }

        public void Set(string key, string value)
        {
            if (string.IsNullOrWhiteSpace(key))
            {
                return;
            }

            values[key] = value ?? string.Empty;
        }

        public bool Remove(string key)
        {
            if (string.IsNullOrWhiteSpace(key))
            {
                return false;
            }

            return values.Remove(key);
        }

        public string Get(string key, string fallback = "")
        {
            if (string.IsNullOrWhiteSpace(key))
            {
                return fallback;
            }

            return values.TryGetValue(key, out var value) ? value : fallback;
        }

        public RoomMetadataEntry[] ToArray()
        {
            var result = new RoomMetadataEntry[values.Count];
            var index = 0;

            foreach (var pair in values)
            {
                result[index++] = new RoomMetadataEntry(pair.Key, pair.Value);
            }

            return result;
        }
    }
}
