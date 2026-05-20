using CXR.SDK.Discovery;
using NUnit.Framework;
using UnityEngine;

public sealed class RuntimeSessionSdkBridgeTests
{
    [Test]
    public void BridgePublishesSessionMetadataIntoDiscoveryResponse()
    {
        var root = new GameObject("Runtime Session SDK Bridge Test");

        try
        {
            var sessionManager = root.AddComponent<RuntimeSessionManager>();
            var broadcaster = root.AddComponent<DiscoveryBroadcaster>();
            var listener = root.AddComponent<DiscoveryListener>();
            var bridge = root.AddComponent<RuntimeSessionSdkBridge>();
            bridge.Initialize(broadcaster, listener);

            Assert.NotNull(sessionManager);
            Assert.NotNull(bridge);
            Assert.NotNull(broadcaster);

            broadcaster.RequireServerActive = false;
            broadcaster.ExplicitPort = 7777;

            bridge.PublishSessionAdvertisement();

            Assert.IsTrue(
                broadcaster.TryBuildResponse(out var response),
                "Expected the SDK broadcaster to build a discovery response.");

            Assert.AreEqual("XR Runtime Session", response.RoomName);
            Assert.AreEqual("Open", response.Status);
            Assert.AreEqual(0, response.PlayerCount);
            Assert.AreEqual(16, response.MaxPlayers);
            Assert.AreEqual(7777, response.Port);

            AssertMetadata(
                response,
                "runtimeSessionState",
                RuntimeSessionState.WaitingForParticipants.ToString());

            AssertMetadata(response, "runtimeParticipantCount", "0");
            AssertMetadata(response, "runtimeTrackedParticipantCount", "0");
            AssertMetadata(response, "runtimeLayer", "RuntimeSessionManager");
        }
        finally
        {
            Object.DestroyImmediate(root);
        }
    }

    private static void AssertMetadata(
        CXRDiscoveryResponse response,
        string key,
        string expectedValue)
    {
        Assert.NotNull(response.Metadata);

        foreach (var entry in response.Metadata)
        {
            if (entry.Key == key)
            {
                Assert.AreEqual(expectedValue, entry.Value);
                return;
            }
        }

        Assert.Fail("Missing metadata entry: " + key);
    }
}
