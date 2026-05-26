using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using UnityEngine;

[DisallowMultipleComponent]
public sealed class RuntimeMetricsExporter : MonoBehaviour
{
    [Header("Snapshot Export")]
    [SerializeField]
    private bool writeSnapshotToFile;

    [SerializeField]
    private string snapshotFileName = "cxr_runtime_metrics.prom";

    [SerializeField]
    private float snapshotIntervalSeconds = 5f;

    private readonly Dictionary<RuntimeEventType, int> eventCounts = new();
    private float nextSnapshotTime;
    private float startedAt;
    private int totalEvents;

    public int TotalEvents => totalEvents;

    private void OnEnable()
    {
        startedAt = Time.realtimeSinceStartup;
        RuntimeEventEmitter.EventEmitted += OnRuntimeEvent;
    }

    private void OnDisable()
    {
        RuntimeEventEmitter.EventEmitted -= OnRuntimeEvent;
    }

    private void Update()
    {
        if (!writeSnapshotToFile ||
            Time.realtimeSinceStartup < nextSnapshotTime)
        {
            return;
        }

        nextSnapshotTime =
            Time.realtimeSinceStartup +
            Mathf.Max(1f, snapshotIntervalSeconds);

        WriteSnapshot();
    }

    public string BuildMetricsSnapshot()
    {
        StringBuilder builder = new StringBuilder();
        float uptime = Mathf.Max(0f, Time.realtimeSinceStartup - startedAt);

        builder.AppendLine("# HELP cxr_runtime_uptime_seconds Runtime uptime in seconds.");
        builder.AppendLine("# TYPE cxr_runtime_uptime_seconds gauge");
        builder.Append("cxr_runtime_uptime_seconds ");
        builder.AppendLine(uptime.ToString("0.###", CultureInfo.InvariantCulture));

        builder.AppendLine("# HELP cxr_runtime_events_total Total emitted runtime events.");
        builder.AppendLine("# TYPE cxr_runtime_events_total counter");
        builder.Append("cxr_runtime_events_total ");
        builder.AppendLine(totalEvents.ToString());

        builder.AppendLine("# HELP cxr_runtime_event_type_total Runtime events grouped by event type.");
        builder.AppendLine("# TYPE cxr_runtime_event_type_total counter");

        foreach (KeyValuePair<RuntimeEventType, int> pair in eventCounts)
        {
            builder.Append("cxr_runtime_event_type_total{event_type=\"");
            builder.Append(pair.Key);
            builder.Append("\"} ");
            builder.AppendLine(pair.Value.ToString());
        }

        RuntimeSessionManager sessionManager = RuntimeSessionManager.Instance;
        if (sessionManager != null)
        {
            builder.AppendLine("# HELP cxr_participants Current runtime participant count.");
            builder.AppendLine("# TYPE cxr_participants gauge");
            builder.Append("cxr_participants ");
            builder.AppendLine(sessionManager.ParticipantCount.ToString());
        }

        return builder.ToString();
    }

    private void OnRuntimeEvent(RuntimeEvent runtimeEvent)
    {
        totalEvents++;

        if (!eventCounts.ContainsKey(runtimeEvent.eventType))
        {
            eventCounts.Add(runtimeEvent.eventType, 0);
        }

        eventCounts[runtimeEvent.eventType]++;
    }

    private void WriteSnapshot()
    {
        string path = Path.Combine(
            Application.persistentDataPath,
            snapshotFileName);

        File.WriteAllText(path, BuildMetricsSnapshot());
    }
}
