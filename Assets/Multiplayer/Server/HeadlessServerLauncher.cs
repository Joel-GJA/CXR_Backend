using System;
using System.Collections.Generic;
using CXR.SDK.Discovery;
using Mirror;
using UnityEngine;

[AddComponentMenu("CXR Multiplayer/Headless Server Launcher")]
[DisallowMultipleComponent]
public sealed class HeadlessServerLauncher : MonoBehaviour
{
    private const string StartFlag = "-cxrHeadlessServer";
    private const string StartLongFlag = "--cxr-headless-server";
    private const string RoomNameFlag = "-roomName";
    private const string RoomNameLongFlag = "--room-name";
    private const string MaxParticipantsFlag = "-maxParticipants";
    private const string MaxParticipantsLongFlag = "--max-participants";
    private const string PortFlag = "-port";
    private const string PortLongFlag = "--port";
    private const string MetadataFlag = "-metadata";
    private const string MetadataLongFlag = "--metadata";
    private const string RegistryUrlFlag = "-registryUrl";
    private const string RegistryUrlLongFlag = "--registry-url";
    private const string PublicAddressFlag = "-publicAddress";
    private const string PublicAddressLongFlag = "--public-address";

    private const string StartEnv = "CXR_HEADLESS_SERVER";
    private const string RoomNameEnv = "CXR_ROOM_NAME";
    private const string MaxParticipantsEnv = "CXR_MAX_PARTICIPANTS";
    private const string PortEnv = "CXR_PORT";
    private const string MetadataEnv = "CXR_METADATA";
    private const string RegistryUrlEnv = "CXR_REGISTRY_URL";
    private const string PublicAddressEnv = "CXR_PUBLIC_ADDRESS";

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

    private void Awake()
    {
        ResolveReferences();
    }

    private void Start()
    {
        HeadlessServerConfig config =
            ParseCommandLine(Environment.GetCommandLineArgs());

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
        ResolveReferences();

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
            TryAssignTransportPort(networkManager.transport, port);
            TryAssignTransportPort(Transport.active, port);
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
        ResolveReferences();

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

    public static HeadlessServerConfig ParseCommandLine(string[] args)
    {
        HeadlessServerConfig config = new HeadlessServerConfig();
        ApplyEnvironment(config);

        if (args == null)
        {
            return config;
        }

        for (int index = 0; index < args.Length; index++)
        {
            string arg = args[index];
            if (string.IsNullOrWhiteSpace(arg))
            {
                continue;
            }

            if (EqualsFlag(arg, StartFlag) ||
                EqualsFlag(arg, StartLongFlag) ||
                EqualsFlag(arg, "-server") ||
                EqualsFlag(arg, "--server"))
            {
                config.StartServer = true;
                continue;
            }

            if (TryReadInlineValue(arg, RoomNameLongFlag, out string inlineRoomName))
            {
                config.RoomName = inlineRoomName;
                continue;
            }

            if (EqualsFlag(arg, RoomNameFlag) ||
                EqualsFlag(arg, RoomNameLongFlag))
            {
                config.RoomName = ReadValue(args, ref index);
                continue;
            }

            if (TryReadInlineValue(
                    arg,
                    MaxParticipantsLongFlag,
                    out string inlineMaxParticipants) &&
                int.TryParse(inlineMaxParticipants, out int inlineMax))
            {
                config.MaxParticipants = Mathf.Max(1, inlineMax);
                continue;
            }

            if (EqualsFlag(arg, MaxParticipantsFlag) ||
                EqualsFlag(arg, MaxParticipantsLongFlag))
            {
                if (int.TryParse(ReadValue(args, ref index), out int value))
                {
                    config.MaxParticipants = Mathf.Max(1, value);
                }

                continue;
            }

            if (TryReadInlineValue(arg, PortLongFlag, out string inlinePort) &&
                int.TryParse(inlinePort, out int inlinePortValue))
            {
                config.Port = Mathf.Max(1, inlinePortValue);
                continue;
            }

            if (EqualsFlag(arg, PortFlag) ||
                EqualsFlag(arg, PortLongFlag))
            {
                if (int.TryParse(ReadValue(args, ref index), out int value))
                {
                    config.Port = Mathf.Max(1, value);
                }

                continue;
            }

            if (TryReadInlineValue(
                    arg,
                    MetadataLongFlag,
                    out string inlineMetadata))
            {
                ParseMetadata(inlineMetadata, config);
                continue;
            }

            if (EqualsFlag(arg, MetadataFlag) ||
                EqualsFlag(arg, MetadataLongFlag))
            {
                ParseMetadata(ReadValue(args, ref index), config);
                continue;
            }

            if (TryReadInlineValue(
                    arg,
                    RegistryUrlLongFlag,
                    out string inlineRegistryUrl))
            {
                config.RegistryUrl = inlineRegistryUrl;
                continue;
            }

            if (EqualsFlag(arg, RegistryUrlFlag) ||
                EqualsFlag(arg, RegistryUrlLongFlag))
            {
                config.RegistryUrl = ReadValue(args, ref index);
                continue;
            }

            if (TryReadInlineValue(
                    arg,
                    PublicAddressLongFlag,
                    out string inlinePublicAddress))
            {
                config.PublicAddress = inlinePublicAddress;
                continue;
            }

            if (EqualsFlag(arg, PublicAddressFlag) ||
                EqualsFlag(arg, PublicAddressLongFlag))
            {
                config.PublicAddress = ReadValue(args, ref index);
            }
        }

        return config;
    }

    private static void ApplyEnvironment(HeadlessServerConfig config)
    {
        if (config == null)
        {
            return;
        }

        string start = Environment.GetEnvironmentVariable(StartEnv);
        if (IsTruthy(start))
        {
            config.StartServer = true;
        }

        string roomName = Environment.GetEnvironmentVariable(RoomNameEnv);
        if (!string.IsNullOrWhiteSpace(roomName))
        {
            config.RoomName = roomName.Trim();
        }

        string maxParticipants =
            Environment.GetEnvironmentVariable(MaxParticipantsEnv);
        if (int.TryParse(maxParticipants, out int maxParticipantsValue))
        {
            config.MaxParticipants = Mathf.Max(1, maxParticipantsValue);
        }

        string port = Environment.GetEnvironmentVariable(PortEnv);
        if (int.TryParse(port, out int portValue))
        {
            config.Port = Mathf.Max(1, portValue);
        }

        string metadata = Environment.GetEnvironmentVariable(MetadataEnv);
        if (!string.IsNullOrWhiteSpace(metadata))
        {
            string[] entries = metadata.Split(';');
            for (int index = 0; index < entries.Length; index++)
            {
                ParseMetadata(entries[index], config);
            }
        }

        string registryUrl = Environment.GetEnvironmentVariable(RegistryUrlEnv);
        if (!string.IsNullOrWhiteSpace(registryUrl))
        {
            config.RegistryUrl = registryUrl.Trim();
        }

        string publicAddress =
            Environment.GetEnvironmentVariable(PublicAddressEnv);
        if (!string.IsNullOrWhiteSpace(publicAddress))
        {
            config.PublicAddress = publicAddress.Trim();
        }
    }

    private void ResolveReferences()
    {
        if (networkManager == null)
        {
            networkManager =
                NetworkManager.singleton ??
                GetComponent<NetworkManager>();
        }

        if (discoveryBroadcaster == null)
        {
            discoveryBroadcaster = GetComponent<DiscoveryBroadcaster>();
        }

        if (sessionSdkBridge == null)
        {
            sessionSdkBridge = GetComponent<RuntimeSessionSdkBridge>();
        }

        if (remoteRegistryPublisher == null)
        {
            remoteRegistryPublisher =
                GetComponent<RemoteRoomRegistryPublisher>();
        }
    }

    private static string ReadValue(string[] args, ref int index)
    {
        int nextIndex = index + 1;
        if (nextIndex >= args.Length)
        {
            return string.Empty;
        }

        index = nextIndex;
        return args[nextIndex] ?? string.Empty;
    }

    private static void ParseMetadata(
        string rawValue,
        HeadlessServerConfig config)
    {
        if (string.IsNullOrWhiteSpace(rawValue) || config == null)
        {
            return;
        }

        int splitIndex = rawValue.IndexOf('=');
        if (splitIndex <= 0)
        {
            return;
        }

        string key = rawValue.Substring(0, splitIndex);
        string value = rawValue.Substring(splitIndex + 1);
        config.SetMetadata(key, value);
    }

    private static bool TryReadInlineValue(
        string arg,
        string flag,
        out string value)
    {
        value = string.Empty;

        string prefix = flag + "=";
        if (string.IsNullOrWhiteSpace(arg) ||
            !arg.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        value = arg.Substring(prefix.Length);
        return true;
    }

    private static bool EqualsFlag(string value, string flag)
    {
        return string.Equals(
            value,
            flag,
            StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsTruthy(string value)
    {
        return string.Equals(value, "1", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(value, "true", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(value, "yes", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(value, "on", StringComparison.OrdinalIgnoreCase);
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

    private static bool TryAssignTransportPort(Transport transport, int port)
    {
        if (transport == null || port <= 0)
        {
            return false;
        }

        Type transportType = transport.GetType();
        var property =
            transportType.GetProperty("Port") ??
            transportType.GetProperty("port") ??
            transportType.GetProperty("ServerPort") ??
            transportType.GetProperty("serverPort");

        if (property != null && property.CanWrite)
        {
            property.SetValue(
                transport,
                Convert.ChangeType(port, property.PropertyType));

            return true;
        }

        var field =
            transportType.GetField("Port") ??
            transportType.GetField("port") ??
            transportType.GetField("ServerPort") ??
            transportType.GetField("serverPort");

        if (field == null)
        {
            return false;
        }

        field.SetValue(transport, Convert.ChangeType(port, field.FieldType));
        return true;
    }
}
