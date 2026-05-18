public readonly struct RuntimeParticipantInfo
{
    public RuntimeParticipantInfo(
        uint participantNetId,
        int connectionId,
        double joinedAt,
        double lastSeenAt,
        bool isConnected)
    {
        ParticipantNetId = participantNetId;
        ConnectionId = connectionId;
        JoinedAt = joinedAt;
        LastSeenAt = lastSeenAt;
        IsConnected = isConnected;
    }

    public uint ParticipantNetId { get; }

    public int ConnectionId { get; }

    public double JoinedAt { get; }

    public double LastSeenAt { get; }

    public bool IsConnected { get; }

    public RuntimeParticipantInfo MarkDisconnected(double disconnectedAt)
    {
        return new RuntimeParticipantInfo(
            ParticipantNetId,
            ConnectionId,
            JoinedAt,
            disconnectedAt,
            false);
    }
}
