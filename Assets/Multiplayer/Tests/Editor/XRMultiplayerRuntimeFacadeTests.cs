using NUnit.Framework;
using UnityEngine;

public sealed class XRMultiplayerRuntimeFacadeTests
{
    [Test]
    public void RoomBrowserModel_NullLifecycleReportsUnavailable()
    {
        XRRoomBrowserModel model = new XRRoomBrowserModel();

        model.SyncFrom(null);

        Assert.AreEqual(0, model.VisibleRoomCount);
        Assert.AreEqual(XRRoomDiscoveryLifecycleState.Idle, model.DiscoveryState);
        Assert.IsNotEmpty(model.LastError);
    }

    [Test]
    public void Facade_ExposesDefaultRuntimeSnapshot()
    {
        GameObject root = new GameObject("Runtime Facade Test");

        try
        {
            RuntimeSessionManager sessionManager =
                root.AddComponent<RuntimeSessionManager>();
            XRMultiplayerRuntimeFacade facade =
                root.AddComponent<XRMultiplayerRuntimeFacade>();

            facade.ResolveReferences();

            Assert.NotNull(sessionManager);
            Assert.AreEqual(
                RuntimeSessionState.WaitingForParticipants,
                facade.SessionState);
            Assert.AreEqual(0, facade.ParticipantCount);
            Assert.AreEqual(0, facade.TrackedParticipantCount);
            Assert.AreEqual(XRConnectionLifecycle.Offline, facade.ConnectionState);
        }
        finally
        {
            Object.DestroyImmediate(root);
        }
    }
}
