using NUnit.Framework;

public sealed class RuntimeEventEmitterTests
{
    [Test]
    public void Emit_CreatesEventAndNotifiesSubscribers()
    {
        RuntimeEvent received = default;
        bool wasCalled = false;

        void Handler(RuntimeEvent runtimeEvent)
        {
            received = runtimeEvent;
            wasCalled = true;
        }

        RuntimeEventEmitter.EventEmitted += Handler;

        try
        {
            RuntimeEvent emitted = RuntimeEventEmitter.Emit(
                RuntimeEventType.OwnershipAcquired,
                "Test",
                "hello",
                participantNetId: 12,
                entityNetId: 34);

            Assert.IsTrue(wasCalled);
            Assert.AreEqual(emitted.eventId, received.eventId);
            Assert.AreEqual(RuntimeEventType.OwnershipAcquired, received.eventType);
            Assert.AreEqual("Test", received.source);
            Assert.AreEqual(12, received.participantNetId);
            Assert.AreEqual(34, received.entityNetId);
            Assert.IsFalse(string.IsNullOrWhiteSpace(received.timestampUtc));
        }
        finally
        {
            RuntimeEventEmitter.EventEmitted -= Handler;
        }
    }
}
