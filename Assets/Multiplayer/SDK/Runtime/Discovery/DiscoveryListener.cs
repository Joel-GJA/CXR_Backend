using System;
using System.Net;
using Mirror;
using Mirror.Discovery;
using UnityEngine;
using CXR.SDK.Utils;

namespace CXR.SDK.Discovery
{
    [AddComponentMenu("CXR SDK/Discovery/Discovery Listener")]
    [DisallowMultipleComponent]
    public sealed class DiscoveryListener : NetworkDiscoveryBase<CXRDiscoveryRequest, CXRDiscoveryResponse>
    {
        [SerializeField] private int protocolVersion = 1;
        [SerializeField] private DiscoveryBroadcaster broadcaster;

        public event Action<CXRDiscoveryResponse, IPEndPoint> RoomDiscovered;

        public int ProtocolVersion => protocolVersion;

        public bool IsAdvertising => serverUdpClient != null;

        public void SetBroadcaster(DiscoveryBroadcaster discoveryBroadcaster)
        {
            broadcaster = discoveryBroadcaster;
        }

        public void RequestRoomRefresh()
        {
            try
            {
                StartDiscovery();
            }
            catch (Exception exception)
            {
                CXRLogger.Warn("Unable to start discovery refresh. " + exception.Message);
            }
        }

        public void BroadcastRoom()
        {
            try
            {
                if (IsAdvertising)
                {
                    return;
                }

                AdvertiseServer();
            }
            catch (Exception exception)
            {
                CXRLogger.Warn("Unable to advertise room. " + exception.Message);
            }
        }

        public void StopRoomDiscovery()
        {
            try
            {
                StopDiscovery();
            }
            catch (Exception exception)
            {
                CXRLogger.Warn("Unable to stop discovery listener. " + exception.Message);
            }
        }

        protected override CXRDiscoveryRequest GetRequest()
        {
            return new CXRDiscoveryRequest
            {
                ProtocolVersion = protocolVersion
            };
        }

        protected override CXRDiscoveryResponse ProcessRequest(CXRDiscoveryRequest request, IPEndPoint endpoint)
        {
            if (request.ProtocolVersion != protocolVersion)
            {
                return default;
            }

            if (broadcaster != null && broadcaster.TryBuildResponse(out var response))
            {
                response.ProtocolVersion = protocolVersion;
                return response;
            }

            return default;
        }

        protected override void ProcessResponse(CXRDiscoveryResponse response, IPEndPoint endpoint)
        {
            if (response.ProtocolVersion != protocolVersion || string.IsNullOrWhiteSpace(response.RoomId))
            {
                return;
            }

            if (string.IsNullOrWhiteSpace(response.IpAddress))
            {
                response.IpAddress = endpoint.Address.ToString();
            }

            if (response.Port <= 0)
            {
                response.Port = endpoint.Port;
            }

            RoomDiscovered?.Invoke(response, endpoint);
        }
    }
}
