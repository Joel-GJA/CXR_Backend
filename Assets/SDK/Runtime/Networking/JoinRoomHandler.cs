using System;
using Mirror;
using UnityEngine;
using CXR.SDK.Rooms;
using CXR.SDK.Utils;

namespace CXR.SDK.Networking
{
    [AddComponentMenu("CXR SDK/Networking/Join Room Handler")]
    [DisallowMultipleComponent]
    public sealed class JoinRoomHandler : MonoBehaviour
    {
        [SerializeField] private NetworkManager networkManager;
        [SerializeField] private bool blockJoinWhileServerActive = true;

        public bool TryJoin(RoomInfo room, out string error)
        {
            error = string.Empty;

            if (room == null)
            {
                error = "No room information was supplied.";
                return false;
            }

            if (string.IsNullOrWhiteSpace(room.IpAddress) || room.Port <= 0)
            {
                error = "The room does not contain a valid IP address and port.";
                return false;
            }

            if (networkManager == null)
            {
                networkManager = NetworkManager.singleton;
            }

            if (networkManager == null)
            {
                error = "Mirror NetworkManager.singleton was not found.";
                return false;
            }

            if (blockJoinWhileServerActive && NetworkServer.active)
            {
                error = "A local Mirror server is already active. Stop the server before joining another room.";
                return false;
            }

            networkManager.networkAddress = room.IpAddress;

            if (!TryAssignTransportPort(Transport.activeTransport, room.Port))
            {
                Logger.Warn("Unable to set the active transport port automatically. Ensure your transport is configured for port " + room.Port + ".");
            }

            Logger.Info("Connecting to " + room.IpAddress + ":" + room.Port + ".");
            networkManager.StartClient();
            return true;
        }

        private static bool TryAssignTransportPort(Transport transport, int port)
        {
            if (transport == null)
            {
                return false;
            }

            var transportType = transport.GetType();
            var property = transportType.GetProperty("Port") ??
                           transportType.GetProperty("port") ??
                           transportType.GetProperty("ServerPort") ??
                           transportType.GetProperty("serverPort");

            if (property != null && property.CanWrite)
            {
                property.SetValue(transport, Convert.ChangeType(port, property.PropertyType));
                return true;
            }

            var field = transportType.GetField("Port") ??
                        transportType.GetField("port") ??
                        transportType.GetField("ServerPort") ??
                        transportType.GetField("serverPort");

            if (field != null)
            {
                field.SetValue(transport, Convert.ChangeType(port, field.FieldType));
                return true;
            }

            return false;
        }
    }
}
