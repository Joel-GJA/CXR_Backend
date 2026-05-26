using System;
using System.Collections.Generic;
using Mirror;
using UnityEngine;

[DisallowMultipleComponent]
public class RuntimeSessionManager : MonoBehaviour
{
    [Header("Disconnect Cleanup")]
    [SerializeField]
    private bool despawnOwnedEntitiesOnDisconnect = true;

    private readonly Dictionary<uint, RuntimeParticipant> participants =
        new();

    private readonly Dictionary<uint, RuntimeParticipantInfo> participantInfos =
        new();

    private readonly Dictionary<int, uint> participantNetIdsByConnectionId =
        new();

    public static RuntimeSessionManager Instance { get; private set; }

    public RuntimeSessionState State { get; private set; } =
        RuntimeSessionState.WaitingForParticipants;

    public int ParticipantCount => participants.Count;

    public IReadOnlyCollection<RuntimeParticipant> Participants =>
        participants.Values;

    public IReadOnlyCollection<RuntimeParticipantInfo> ParticipantInfos =>
        participantInfos.Values;

    public event Action<RuntimeSessionState, RuntimeSessionState>
        StateChanged;

    public event Action<RuntimeParticipant> ParticipantRegistered;

    public event Action<RuntimeParticipant> ParticipantUnregistered;

    private void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Debug.LogWarning(
                "[SESSION] Replacing existing RuntimeSessionManager instance.");
        }

        Instance = this;
    }

    private void OnDestroy()
    {
        if (Instance == this)
        {
            Instance = null;
        }
    }

    [Server]
    public void BeginServerSession()
    {
        participants.Clear();
        participantInfos.Clear();
        participantNetIdsByConnectionId.Clear();

        TransitionTo(RuntimeSessionState.WaitingForParticipants);

        Debug.Log("[SESSION] Server Session Ready");

        RuntimeEventEmitter.Emit(
            RuntimeEventType.SessionStarted,
            nameof(RuntimeSessionManager),
            "Server session ready.");
    }

    [Server]
    public void ShutdownSession()
    {
        TransitionTo(RuntimeSessionState.ShuttingDown);

        foreach (RuntimeParticipant participant in participants.Values)
        {
            CleanupParticipantRuntimeState(participant);
        }

        participants.Clear();
        participantInfos.Clear();
        participantNetIdsByConnectionId.Clear();

        Debug.Log("[SESSION] Server Session Shutdown");

        RuntimeEventEmitter.Emit(
            RuntimeEventType.SessionEnded,
            nameof(RuntimeSessionManager),
            "Server session shutdown.");
    }

    [Server]
    public bool RegisterParticipant(RuntimeParticipant participant)
    {
        if (participant == null)
        {
            Debug.LogWarning("[SESSION] Ignored null participant registration.");
            return false;
        }

        uint participantNetId = participant.netId;
        if (participants.ContainsKey(participantNetId))
        {
            Debug.LogWarning(
                $"[SESSION] Duplicate Participant Registration | " +
                $"NetID={participantNetId}");

            return false;
        }

        TransitionTo(RuntimeSessionState.Initializing);

        EnsureParticipantInitialized(participant);
        participants.Add(participantNetId, participant);
        RegisterParticipantInfo(participant);

        Debug.Log(
            $"[SESSION] Participant Registered | " +
            $"NetID={participantNetId} | " +
            $"ConnectionID={ResolveConnectionId(participant)} | " +
            $"Participants={ParticipantCount}");

        ParticipantRegistered?.Invoke(participant);

        RuntimeEventEmitter.Emit(
            RuntimeEventType.PlayerJoined,
            nameof(RuntimeSessionManager),
            "Participant registered.",
            participantNetId);

        TransitionTo(RuntimeSessionState.Active);

        return true;
    }

    [Server]
    public bool UnregisterParticipant(RuntimeParticipant participant)
    {
        if (participant == null)
        {
            return false;
        }

        uint participantNetId = participant.netId;
        if (!participants.Remove(participantNetId))
        {
            return false;
        }

        MarkParticipantDisconnected(participant);

        Debug.Log(
            $"[SESSION] Participant Unregistered | " +
            $"NetID={participantNetId} | " +
            $"Participants={ParticipantCount}");

        ParticipantUnregistered?.Invoke(participant);

        RuntimeEventEmitter.Emit(
            RuntimeEventType.PlayerLeft,
            nameof(RuntimeSessionManager),
            "Participant unregistered.",
            participantNetId);

        HandleEmptySession();

        return true;
    }

    [Server]
    public void HandleClientDisconnect(NetworkConnectionToClient conn)
    {
        if (conn == null)
        {
            return;
        }

        RuntimeParticipant participant =
            conn.identity != null
                ? conn.identity.GetComponent<RuntimeParticipant>()
                : null;

        if (participant == null)
        {
            TryGetParticipantForConnection(
                conn.connectionId,
                out participant);
        }

        if (participant == null)
        {
            Debug.Log(
                $"[SESSION] Disconnect Without RuntimeParticipant | " +
                $"ConnectionID={conn.connectionId}");

            return;
        }

        HandleParticipantDisconnect(participant);
    }

    [Server]
    public void HandleParticipantDisconnect(RuntimeParticipant participant)
    {
        if (participant == null)
        {
            return;
        }

        if (!participants.ContainsKey(participant.netId))
        {
            return;
        }

        CleanupParticipantRuntimeState(participant);
        UnregisterParticipant(participant);
    }

    [Server]
    public void CleanupParticipantRuntimeState(
        RuntimeParticipant participant)
    {
        if (participant == null)
        {
            return;
        }

        uint participantNetId = participant.netId;
        List<RuntimeEntity> ownedEntities =
            RuntimeEntityRegistry.GetOwnedEntities(participantNetId);

        foreach (RuntimeEntity entity in ownedEntities)
        {
            if (entity == null || entity == participant)
            {
                continue;
            }

            if (despawnOwnedEntitiesOnDisconnect)
            {
                RuntimeSpawnService.DespawnEntity(entity);

                Debug.Log(
                    $"[SESSION CLEANUP] Despawned Owned Entity | " +
                    $"EntityNetID={entity.netId} | " +
                    $"FormerOwner={participantNetId}");
            }
            else
            {
                entity.ClearOwner();
                entity.Cleanup();

                Debug.Log(
                    $"[SESSION CLEANUP] Released Entity Ownership | " +
                    $"EntityNetID={entity.netId} | " +
                    $"FormerOwner={participantNetId}");
            }
        }
    }

    public bool TryGetParticipant(
        uint participantNetId,
        out RuntimeParticipant participant)
    {
        return participants.TryGetValue(participantNetId, out participant);
    }

    public bool TryGetParticipantInfo(
        uint participantNetId,
        out RuntimeParticipantInfo participantInfo)
    {
        return participantInfos.TryGetValue(
            participantNetId,
            out participantInfo);
    }

    public bool TryGetParticipantForConnection(
        int connectionId,
        out RuntimeParticipant participant)
    {
        participant = null;

        if (!participantNetIdsByConnectionId.TryGetValue(
                connectionId,
                out uint participantNetId))
        {
            return false;
        }

        return TryGetParticipant(participantNetId, out participant);
    }

    public bool TryGetParticipantInfoForConnection(
        int connectionId,
        out RuntimeParticipantInfo participantInfo)
    {
        participantInfo = default;

        if (!participantNetIdsByConnectionId.TryGetValue(
                connectionId,
                out uint participantNetId))
        {
            return false;
        }

        return TryGetParticipantInfo(participantNetId, out participantInfo);
    }

    private void EnsureParticipantInitialized(
        RuntimeParticipant participant)
    {
        if (!participant.isInitialized)
        {
            participant.Initialize(participant.netId);
        }

        if (participant.CurrentState != RuntimeEntityState.Active)
        {
            participant.Activate();
        }
    }

    private void RegisterParticipantInfo(RuntimeParticipant participant)
    {
        int connectionId = ResolveConnectionId(participant);
        double now = NetworkTime.time;
        uint participantNetId = participant.netId;

        participantInfos[participantNetId] =
            new RuntimeParticipantInfo(
                participantNetId,
                connectionId,
                now,
                now,
                true);

        if (connectionId >= 0)
        {
            participantNetIdsByConnectionId[connectionId] =
                participantNetId;
        }
    }

    private void MarkParticipantDisconnected(RuntimeParticipant participant)
    {
        uint participantNetId = participant.netId;

        if (!participantInfos.TryGetValue(
                participantNetId,
                out RuntimeParticipantInfo participantInfo))
        {
            return;
        }

        participantInfos[participantNetId] =
            participantInfo.MarkDisconnected(NetworkTime.time);

        if (participantInfo.ConnectionId >= 0)
        {
            participantNetIdsByConnectionId.Remove(
                participantInfo.ConnectionId);
        }
    }

    private int ResolveConnectionId(RuntimeParticipant participant)
    {
        return participant.connectionToClient != null
            ? participant.connectionToClient.connectionId
            : -1;
    }

    private void HandleEmptySession()
    {
        if (State == RuntimeSessionState.ShuttingDown)
        {
            return;
        }

        if (ParticipantCount == 0)
        {
            TransitionTo(RuntimeSessionState.WaitingForParticipants);
        }
    }

    private void TransitionTo(RuntimeSessionState nextState)
    {
        if (State == nextState)
        {
            return;
        }

        RuntimeSessionState previousState = State;
        State = nextState;

        Debug.Log(
            $"[SESSION] State Changed | " +
            $"{previousState} -> {State}");

        StateChanged?.Invoke(previousState, State);
    }
}
