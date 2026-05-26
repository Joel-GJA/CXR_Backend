using System;
using UnityEngine;

public static class RuntimeEventEmitter
{
    public static event Action<RuntimeEvent> EventEmitted;

    public static RuntimeEvent Emit(
        RuntimeEventType eventType,
        string source,
        string message = "",
        uint participantNetId = 0,
        uint entityNetId = 0,
        string roomId = "",
        string sessionId = "",
        string metadataJson = "")
    {
        RuntimeEvent runtimeEvent = new RuntimeEvent(
            eventType,
            source,
            message,
            participantNetId,
            entityNetId,
            roomId,
            sessionId,
            metadataJson);

        Emit(runtimeEvent);
        return runtimeEvent;
    }

    public static void Emit(RuntimeEvent runtimeEvent)
    {
        EventEmitted?.Invoke(runtimeEvent);

        Debug.Log(
            $"[RUNTIME EVENT] {runtimeEvent.eventType} | " +
            $"Source={runtimeEvent.source} | " +
            $"Participant={runtimeEvent.participantNetId} | " +
            $"Entity={runtimeEvent.entityNetId} | " +
            runtimeEvent.message);
    }
}
