using System;
using UnityEngine;

public static class CommandLineParser
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

    public static HeadlessServerConfig Parse(string[] args)
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
}
