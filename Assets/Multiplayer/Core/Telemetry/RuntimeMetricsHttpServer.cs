using System;
using System.Net;
using System.Text;
using System.Threading;
using UnityEngine;

[DisallowMultipleComponent]
public sealed class RuntimeMetricsHttpServer : MonoBehaviour
{
    [SerializeField]
    private int port = 9500;

    [SerializeField]
    private bool startOnEnable = true;

    [SerializeField]
    private float cacheIntervalSeconds = 1f;

    private HttpListener listener;
    private Thread serverThread;
    private volatile bool running;
    private RuntimeMetricsExporter metricsExporter;
    private string cachedMetrics = "";
    private float nextCacheTime;

    private void OnEnable()
    {
        metricsExporter = GetComponent<RuntimeMetricsExporter>();
        if (metricsExporter == null)
            metricsExporter = FindObjectOfType<RuntimeMetricsExporter>();

        if (startOnEnable)
            StartServer();
    }

    private void OnDisable()
    {
        StopServer();
    }

    private void Update()
    {
        if (!running || metricsExporter == null)
            return;

        if (Time.realtimeSinceStartup >= nextCacheTime)
        {
            nextCacheTime = Time.realtimeSinceStartup + Mathf.Max(0.5f, cacheIntervalSeconds);
            cachedMetrics = metricsExporter.BuildMetricsSnapshot();
        }
    }

    public void StartServer()
    {
        if (running)
            return;

        running = true;
        listener = new HttpListener();
        listener.Prefixes.Add($"http://*:{port}/");

        try
        {
            listener.Start();
            serverThread = new Thread(ServerLoop)
            {
                IsBackground = true,
                Name = "MetricsHTTPServer"
            };
            serverThread.Start();
            Debug.Log($"[MetricsServer] Listening on http://0.0.0.0:{port}/metrics");
        }
        catch (Exception ex)
        {
            Debug.LogError($"[MetricsServer] Failed to start: {ex.Message}");
            running = false;
        }
    }

    public void StopServer()
    {
        running = false;

        if (listener != null && listener.IsListening)
        {
            try
            {
                listener.Stop();
            }
            catch
            {
            }

            listener.Close();
        }

        serverThread = null;
    }

    private void ServerLoop()
    {
        while (running)
        {
            try
            {
                HttpListenerContext context = listener.GetContext();
                ProcessRequest(context);
            }
            catch (HttpListenerException) when (!running)
            {
                break;
            }
            catch (Exception ex)
            {
                Debug.LogError($"[MetricsServer] Request error: {ex.Message}");
            }
        }
    }

    private void ProcessRequest(HttpListenerContext context)
    {
        HttpListenerRequest req = context.Request;
        HttpListenerResponse res = context.Response;

        try
        {
            string path = req.Url.AbsolutePath;

            if (req.HttpMethod == "GET" && path == "/metrics")
            {
                string body = string.IsNullOrEmpty(cachedMetrics)
                    ? "# No metrics available yet\n"
                    : cachedMetrics;

                byte[] data = Encoding.UTF8.GetBytes(body);
                res.ContentType = "text/plain; charset=utf-8";
                res.ContentLength64 = data.Length;
                res.OutputStream.Write(data, 0, data.Length);
            }
            else if (req.HttpMethod == "GET" && path == "/health")
            {
                string body = $"{{\"ok\":true,\"service\":\"cxr-room-metrics\",\"port\":{port}}}";
                byte[] data = Encoding.UTF8.GetBytes(body);
                res.ContentType = "application/json";
                res.ContentLength64 = data.Length;
                res.OutputStream.Write(data, 0, data.Length);
            }
            else
            {
                res.StatusCode = 404;
                byte[] data = Encoding.UTF8.GetBytes("{\"error\":\"not found\"}");
                res.ContentType = "application/json";
                res.ContentLength64 = data.Length;
                res.OutputStream.Write(data, 0, data.Length);
            }
        }
        finally
        {
            res.OutputStream.Close();
        }
    }

    private void OnApplicationQuit()
    {
        StopServer();
    }
}
