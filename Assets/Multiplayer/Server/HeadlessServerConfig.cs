using System.Collections.Generic;

public sealed class HeadlessServerConfig
{
    private readonly Dictionary<string, string> metadata =
        new Dictionary<string, string>();

    public bool StartServer { get; set; }

    public string RoomName { get; set; } = string.Empty;

    public int MaxParticipants { get; set; }

    public int Port { get; set; }

    public string RegistryUrl { get; set; } = string.Empty;

    public string PublicAddress { get; set; } = string.Empty;

    public IReadOnlyDictionary<string, string> Metadata => metadata;

    public bool HasRoomName => !string.IsNullOrWhiteSpace(RoomName);

    public bool HasMaxParticipants => MaxParticipants > 0;

    public bool HasPort => Port > 0;

    public bool HasRegistryUrl => !string.IsNullOrWhiteSpace(RegistryUrl);

    public bool HasPublicAddress => !string.IsNullOrWhiteSpace(PublicAddress);

    public void SetMetadata(string key, string value)
    {
        if (string.IsNullOrWhiteSpace(key))
        {
            return;
        }

        metadata[key.Trim()] = value ?? string.Empty;
    }
}
