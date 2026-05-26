using System.IO;
using UnityEngine;

[DisallowMultipleComponent]
public sealed class RuntimeEventFileSink : MonoBehaviour
{
    [SerializeField]
    private bool writeEventsToFile = true;

    [SerializeField]
    private string fileName = "cxr_runtime_events.jsonl";

    private StreamWriter writer;

    private void OnEnable()
    {
        if (writeEventsToFile)
        {
            string path = Path.Combine(Application.persistentDataPath, fileName);
            writer = new StreamWriter(path, append: true);
            writer.AutoFlush = true;
        }

        RuntimeEventEmitter.EventEmitted += OnRuntimeEvent;
    }

    private void OnDisable()
    {
        RuntimeEventEmitter.EventEmitted -= OnRuntimeEvent;

        writer?.Dispose();
        writer = null;
    }

    private void OnRuntimeEvent(RuntimeEvent runtimeEvent)
    {
        writer?.WriteLine(runtimeEvent.ToJson());
    }
}
