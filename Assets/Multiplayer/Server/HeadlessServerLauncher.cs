using System;
using System.Collections.Generic;
using CXR.SDK.Discovery;
using CXR.SDK.Utils;
using Mirror;
using UnityEngine;

[AddComponentMenu("CXR Multiplayer/Headless Server Launcher")]
[DisallowMultipleComponent]
public sealed class HeadlessServerLauncher : MonoBehaviour
{
    [Header("Startup")]
    [SerializeField]
    private NetworkManager networkManager;

    [SerializeField]
    private bool autoStartInBatchMode = true;

    [SerializeField]
    private bool requireHeadlessFlagOutsideBatchMode = true;

    [Header("Defaults")]
    [SerializeField]
    private string defaultRoomName = "XR Runtime Session";

    [SerializeField]
    private int defaultMaxParticipants = 16;

    [SerializeField]
    private int defaultPort = 7777;

    [Header("Advertisement")]
    [SerializeField]
    private DiscoveryBroadcaster discoveryBroadcaster;

    [SerializeField]
    private RuntimeSessionSdkBridge sessionSdkBridge;

    [SerializeField]
    private RemoteRoomRegistryPublisher remoteRegistryPublisher;

    [SerializeField]
    private bool markAsDedicatedServer = true;

    [Header("Console Logging")]
    [SerializeField]
    private bool logServerHeartbeat = true;

    [SerializeField]
    private float heartbeatLogIntervalSeconds = 30f;

    private string activeRoomName = "XR Runtime Session";
    private int activePort = 7777;
    private float nextHeartbeatLogTime;

    public bool HasStartedServer { get; private set; }

    public HeadlessServerConfig LastAppliedConfig { get; private set; }

    public void Initialize(
        DiscoveryBroadcaster broadcaster,
        RuntimeSessionSdkBridge sdkBridge,
        RemoteRoomRegistryPublisher registryPublisher)
    {
        discoveryBroadcaster = broadcaster;
        sessionSdkBridge = sdkBridge;
        remoteRegistryPublisher = registryPublisher;
    }

    private void Awake()
    {
        ResolveNetworkManager();
    }

    private void Start()
    {
        HeadlessServerConfig config =
            CommandLineParser.Parse(Environment.GetCommandLineArgs());

        if (!ShouldStart(config))
        {
            return;
        }

        ApplyConfiguration(config);
        StartServer();
    }

    public bool ShouldStart(HeadlessServerConfig config)
    {
        if (config != null && config.StartServer)
        {
            return true;
        }

        if (Application.isBatchMode && autoStartInBatchMode)
        {
            return true;
        }

        return !requireHeadlessFlagOutsideBatchMode &&
            config != null &&
            config.StartServer;
    }

    public void ApplyConfiguration(HeadlessServerConfig config)
    {
        ResolveNetworkManager();

        HeadlessServerConfig resolved = config ?? new HeadlessServerConfig();

        string roomName = resolved.HasRoomName
            ? resolved.RoomName
            : defaultRoomName;

        int maxParticipants = resolved.HasMaxParticipants
            ? resolved.MaxParticipants
            : defaultMaxParticipants;

        int port = resolved.HasPort
            ? resolved.Port
            : defaultPort;

        string publicAddress = resolved.HasPublicAddress
            ? resolved.PublicAddress
            : string.Empty;

        activeRoomName = roomName;
        activePort = port;

        if (networkManager != null)
        {
            EnsureActiveTransport(networkManager);
            TransportPortHelper.TrySetPort(networkManager.transport, port);
            TransportPortHelper.TrySetPort(Transport.active, port);
        }

        if (discoveryBroadcaster != null)
        {
            discoveryBroadcaster.RoomName = roomName;
            discoveryBroadcaster.MaxPlayers = maxParticipants;
            discoveryBroadcaster.ExplicitPort = port;

            if (markAsDedicatedServer)
            {
                discoveryBroadcaster.SetMetadata(
                    "serverMode",
                    "Dedicated");
            }

            foreach (KeyValuePair<string, string> entry in resolved.Metadata)
            {
                discoveryBroadcaster.SetMetadata(entry.Key, entry.Value);
            }
        }

        if (sessionSdkBridge != null)
        {
            sessionSdkBridge.RoomName = roomName;
            sessionSdkBridge.MaxParticipants = maxParticipants;
            sessionSdkBridge.PublishSessionAdvertisement();
        }

        if (remoteRegistryPublisher != null)
        {
            if (resolved.HasRegistryUrl)
            {
                remoteRegistryPublisher.RegistryUrl = resolved.RegistryUrl;
            }

            if (!string.IsNullOrWhiteSpace(publicAddress))
            {
                remoteRegistryPublisher.PublicAddress = publicAddress;
            }

            remoteRegistryPublisher.PublicPort = port;
            remoteRegistryPublisher.PublishNow();
        }

        LastAppliedConfig = resolved;

        Debug.Log(
            "[HEADLESS SERVER] Configuration applied | " +
            $"RoomName={roomName} | " +
            $"Port={port} | " +
            $"MaxParticipants={maxParticipants} | " +
            $"PublicAddress={(string.IsNullOrWhiteSpace(publicAddress) ? "auto" : publicAddress)} | " +
            $"RegistryUrl={(resolved.HasRegistryUrl ? resolved.RegistryUrl : "none")}");
    }

    public void StartServer()
    {
        ResolveNetworkManager();

        if (networkManager == null || NetworkServer.active)
        {
            return;
        }

        EnsureActiveTransport(networkManager);
        networkManager.StartServer();
        HasStartedServer = true;
        nextHeartbeatLogTime = Time.unscaledTime;

        Debug.Log("[HEADLESS SERVER] Dedicated server started.");
    }

    private void Update()
    {
        if (!logServerHeartbeat || !NetworkServer.active)
        {
            return;
        }

        if (Time.unscaledTime < nextHeartbeatLogTime)
        {
            return;
        }

        nextHeartbeatLogTime =
            Time.unscaledTime + Mathf.Max(5f, heartbeatLogIntervalSeconds);

        Debug.Log(
            "[HEADLESS SERVER] Heartbeat | " +
            $"RoomName={activeRoomName} | " +
            $"Port={activePort} | " +
            $"Connections={ResolveConnectionCount()} | " +
            $"Time={DateTime.UtcNow:O}");
    }

    private void ResolveNetworkManager()
    {
        if (networkManager == null)
        {
            networkManager =
                NetworkManager.singleton ??
                GetComponent<NetworkManager>();
        }
    }

    private static void EnsureActiveTransport(NetworkManager manager)
    {
        if (Transport.active == null && manager.transport != null)
        {
            Transport.active = manager.transport;
        }
    }

    private static int ResolveConnectionCount()
    {
        return NetworkServer.connections != null
            ? NetworkServer.connections.Count
            : 0;
    }
}
