using NUnit.Framework;
using UnityEngine;

// Validates that RuntimeMetricsExporter aggregates RuntimeEvents into a
// correct Prometheus exposition snapshot (Track B — Telemetry & Observability).
public sealed class RuntimeMetricsExporterTests
{
    private GameObject host;
    private RuntimeMetricsExporter exporter;

    [SetUp]
    public void SetUp()
    {
        // AddComponent on an active GameObject runs OnEnable, which subscribes
        // the exporter to RuntimeEventEmitter.EventEmitted.
        host = new GameObject("MetricsExporterTestHost");
        exporter = host.AddComponent<RuntimeMetricsExporter>();
    }

    [TearDown]
    public void TearDown()
    {
        // DestroyImmediate triggers OnDisable, unsubscribing from the static event
        // so counts never leak between tests.
        if (host != null)
        {
            Object.DestroyImmediate(host);
        }
    }

    [Test]
    public void Snapshot_CountsTotalAndPerTypeEvents()
    {
        RuntimeEventEmitter.Emit(RuntimeEventType.PlayerJoined, "Test");
        RuntimeEventEmitter.Emit(RuntimeEventType.PlayerJoined, "Test");
        RuntimeEventEmitter.Emit(RuntimeEventType.PlayerLeft, "Test");

        Assert.AreEqual(3, exporter.TotalEvents, "Exporter should count every emitted event.");

        string snapshot = exporter.BuildMetricsSnapshot();

        StringAssert.Contains("cxr_runtime_events_total 3", snapshot);
        StringAssert.Contains("event_type=\"PlayerJoined\"} 2", snapshot);
        StringAssert.Contains("event_type=\"PlayerLeft\"} 1", snapshot);
    }

    [Test]
    public void Snapshot_EmitsValidPrometheusHeaders()
    {
        RuntimeEventEmitter.Emit(RuntimeEventType.RoomStarted, "Test");

        string snapshot = exporter.BuildMetricsSnapshot();

        // Every metric family must declare HELP + TYPE before its samples.
        StringAssert.Contains("# HELP cxr_runtime_uptime_seconds", snapshot);
        StringAssert.Contains("# TYPE cxr_runtime_uptime_seconds gauge", snapshot);
        StringAssert.Contains("# HELP cxr_runtime_events_total", snapshot);
        StringAssert.Contains("# TYPE cxr_runtime_events_total counter", snapshot);
        StringAssert.Contains("# TYPE cxr_runtime_event_type_total counter", snapshot);
    }

    [Test]
    public void Snapshot_StartsEmptyBeforeAnyEvents()
    {
        string snapshot = exporter.BuildMetricsSnapshot();

        Assert.AreEqual(0, exporter.TotalEvents);
        StringAssert.Contains("cxr_runtime_events_total 0", snapshot);
    }
}
