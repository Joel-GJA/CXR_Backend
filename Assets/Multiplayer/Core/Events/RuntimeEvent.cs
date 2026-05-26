using System;
using UnityEngine;

[Serializable]
public struct RuntimeEvent
{
    public string eventId;
    public RuntimeEventType eventType;
    public string timestampUtc;
    public string source;
    public string roomId;
    public string sessionId;
    public uint participantNetId;
    public uint entityNetId;
    public string message;
    public string metadataJson;

    public RuntimeEvent(
        RuntimeEventType eventType,
        string source,
        string message = "",
        uint participantNetId = 0,
        uint entityNetId = 0,
        string roomId = "",
        string sessionId = "",
        string metadataJson = "")
    {
        eventId = Guid.NewGuid().ToString("N");
        this.eventType = eventType;
        timestampUtc = DateTime.UtcNow.ToString("o");
        this.source = source ?? string.Empty;
        this.roomId = roomId ?? string.Empty;
        this.sessionId = sessionId ?? string.Empty;
        this.participantNetId = participantNetId;
        this.entityNetId = entityNetId;
        this.message = message ?? string.Empty;
        this.metadataJson = metadataJson ?? string.Empty;
    }

    public string ToJson()
    {
        return JsonUtility.ToJson(this);
    }
}
