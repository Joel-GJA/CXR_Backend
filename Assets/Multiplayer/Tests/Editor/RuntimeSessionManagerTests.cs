using NUnit.Framework;
using UnityEngine;

public sealed class RuntimeSessionManagerTests
{
    [Test]
    public void NewManager_ExposesEmptyWaitingSnapshot()
    {
        GameObject root = new GameObject("Runtime Session Manager Test");

        try
        {
            RuntimeSessionManager sessionManager =
                root.AddComponent<RuntimeSessionManager>();

            Assert.AreEqual(
                RuntimeSessionState.WaitingForParticipants,
                sessionManager.State);
            Assert.AreEqual(0, sessionManager.ParticipantCount);
            Assert.AreEqual(0, sessionManager.ParticipantInfos.Count);
        }
        finally
        {
            Object.DestroyImmediate(root);
        }
    }

    [Test]
    public void RuntimeParticipantInfo_MarkDisconnectedKeepsIdentity()
    {
        RuntimeParticipantInfo info =
            new RuntimeParticipantInfo(
                participantNetId: 42,
                connectionId: 7,
                joinedAt: 10.0,
                lastSeenAt: 11.0,
                isConnected: true);

        RuntimeParticipantInfo disconnected =
            info.MarkDisconnected(15.0);

        Assert.AreEqual(42, disconnected.ParticipantNetId);
        Assert.AreEqual(7, disconnected.ConnectionId);
        Assert.AreEqual(10.0, disconnected.JoinedAt);
        Assert.AreEqual(15.0, disconnected.LastSeenAt);
        Assert.IsFalse(disconnected.IsConnected);
    }

    [Test]
    public void TryGetParticipantForMissingConnection_ReturnsFalse()
    {
        GameObject root = new GameObject("Runtime Session Lookup Test");

        try
        {
            RuntimeSessionManager sessionManager =
                root.AddComponent<RuntimeSessionManager>();

            bool foundParticipant =
                sessionManager.TryGetParticipantForConnection(
                    123,
                    out RuntimeParticipant participant);

            bool foundInfo =
                sessionManager.TryGetParticipantInfoForConnection(
                    123,
                    out RuntimeParticipantInfo participantInfo);

            Assert.IsFalse(foundParticipant);
            Assert.IsNull(participant);
            Assert.IsFalse(foundInfo);
            Assert.AreEqual(default(RuntimeParticipantInfo), participantInfo);
        }
        finally
        {
            Object.DestroyImmediate(root);
        }
    }
}
