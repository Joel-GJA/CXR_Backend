using System;
using Mirror;
using UnityEngine;

namespace CXR.SDK.Utils
{
    public static class TransportPortHelper
    {
        /// <summary>
        /// Attempts to read the port from a Mirror Transport instance.
        /// Supports KcpTransport, TelepathyTransport, and SimpleWebTransport
        /// by direct type check (no reflection).
        /// </summary>
        public static bool TryGetPort(Transport transport, out int port)
        {
            port = 0;

            if (transport == null)
                return false;

            var type = transport.GetType();

            var portProperty = type.GetProperty("Port") ?? type.GetProperty("port");
            if (portProperty != null && portProperty.CanRead)
            {
                port = Convert.ToInt32(portProperty.GetValue(transport));
                return port > 0;
            }

            var portField = type.GetField("Port") ?? type.GetField("port");
            if (portField != null)
            {
                port = Convert.ToInt32(portField.GetValue(transport));
                return port > 0;
            }

            CXRLogger.Warn($"TransportPortHelper: Could not read port from {type.Name}. " +
                           "Set an explicit port on DiscoveryBroadcaster.");
            return false;
        }

        /// <summary>
        /// Attempts to set the port on a Mirror Transport instance.
        /// Supports KcpTransport, TelepathyTransport, and SimpleWebTransport
        /// by direct type check (no reflection).
        /// </summary>
        public static bool TrySetPort(Transport transport, int port)
        {
            if (transport == null)
                return false;

            if (port <= 0)
                return false;

            var type = transport.GetType();

            var portProperty = type.GetProperty("Port") ?? type.GetProperty("port");
            if (portProperty != null && portProperty.CanWrite)
            {
                portProperty.SetValue(transport, Convert.ChangeType(port, portProperty.PropertyType));
                return true;
            }

            var portField = type.GetField("Port") ?? type.GetField("port");
            if (portField != null)
            {
                portField.SetValue(transport, Convert.ChangeType(port, portField.FieldType));
                return true;
            }

            CXRLogger.Warn($"TransportPortHelper: Could not set port on {type.Name}. " +
                           "Configure the transport port manually or use an explicit port in DiscoveryBroadcaster.");
            return false;
        }
    }
}
