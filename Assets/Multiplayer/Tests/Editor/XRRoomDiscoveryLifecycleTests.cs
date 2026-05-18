using NUnit.Framework;
using UnityEngine;

public sealed class XRRoomDiscoveryLifecycleTests
{
    [Test]
    public void StopDiscovery_ClearsRoomsAndMarksStopped()
    {
        GameObject root = new GameObject("XR Discovery Lifecycle Test");

        try
        {
            XRRoomDiscoveryLifecycle lifecycle =
                root.AddComponent<XRRoomDiscoveryLifecycle>();

            lifecycle.StopDiscovery();

            Assert.AreEqual(
                XRRoomDiscoveryLifecycleState.Stopped,
                lifecycle.State);

            Assert.AreEqual(0, lifecycle.VisibleRoomCount);
        }
        finally
        {
            Object.DestroyImmediate(root);
        }
    }

    [Test]
    public void JoinMissingRoom_ReturnsFailureState()
    {
        GameObject root = new GameObject("XR Discovery Join Test");

        try
        {
            XRRoomDiscoveryLifecycle lifecycle =
                root.AddComponent<XRRoomDiscoveryLifecycle>();

            bool joined = lifecycle.JoinRoom("missing-room", out string error);

            Assert.IsFalse(joined);
            Assert.AreEqual(
                XRRoomDiscoveryLifecycleState.Failed,
                lifecycle.State);
            Assert.IsNotEmpty(error);
        }
        finally
        {
            Object.DestroyImmediate(root);
        }
    }
}
