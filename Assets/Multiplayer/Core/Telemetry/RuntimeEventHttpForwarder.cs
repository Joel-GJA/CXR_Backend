using System;
using System.Net.Http;
using System.Text;
using UnityEngine;

[DisallowMultipleComponent]
public sealed class RuntimeEventHttpForwarder : MonoBehaviour
{
    [SerializeField]
    private string targetUrl = "http://127.0.0.1:9090/api/events";

    [SerializeField]
    private bool forwardOnEnable = true;

    private static readonly HttpClient httpClient = new HttpClient();

    private void OnEnable()
    {
        if (forwardOnEnable)
            RuntimeEventEmitter.EventEmitted += OnRuntimeEvent;
    }

    private void OnDisable()
    {
        RuntimeEventEmitter.EventEmitted -= OnRuntimeEvent;
    }

    private void OnRuntimeEvent(RuntimeEvent runtimeEvent)
    {
        ForwardEventAsync(runtimeEvent);
    }

    private async void ForwardEventAsync(RuntimeEvent runtimeEvent)
    {
        try
        {
            string json = runtimeEvent.ToJson();
            StringContent content = new StringContent(json, Encoding.UTF8, "application/json");
            HttpResponseMessage response = await httpClient.PostAsync(targetUrl, content);
        }
        catch
        {
        }
    }
}
