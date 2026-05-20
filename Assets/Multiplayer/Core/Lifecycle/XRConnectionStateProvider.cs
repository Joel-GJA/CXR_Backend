using Mirror;
using UnityEngine;

public sealed class XRConnectionStateProvider
{
    public XRConnectionLifecycle ConnectionState
    {
        get
        {
            if (NetworkServer.active && NetworkClient.isConnected)
            {
                return XRConnectionLifecycle.HostActive;
            }

            if (NetworkServer.active)
            {
                return XRConnectionLifecycle.ServerActive;
            }

            if (NetworkClient.isConnected)
            {
                return XRConnectionLifecycle.ClientConnected;
            }

            if (NetworkClient.active)
            {
                return XRConnectionLifecycle.ClientConnecting;
            }

            return XRConnectionLifecycle.Offline;
        }
    }

    public bool IsServerActive => NetworkServer.active;

    public bool IsClientConnected => NetworkClient.isConnected;

    public bool IsClientConnecting =>
        NetworkClient.active && !NetworkClient.isConnected;

    public uint LocalPlayerNetId =>
        NetworkClient.localPlayer != null
            ? NetworkClient.localPlayer.netId
            : 0;

    public int LocalConnectionId =>
        NetworkClient.localPlayer != null &&
        NetworkClient.localPlayer.connectionToClient != null
            ? NetworkClient.localPlayer.connectionToClient.connectionId
            : -1;

    public string NetworkAddress =>
        NetworkManager.singleton != null
            ? NetworkManager.singleton.networkAddress
            : string.Empty;

    public int ConnectedClientCount
    {
        get
        {
            XRNetworkManager mgr =
                NetworkManager.singleton as XRNetworkManager;
            return mgr != null
                ? mgr.GetConnectedClientCount()
                : 0;
        }
    }

    public bool TryGetActiveNetworkManager(out NetworkManager manager)
    {
        manager = NetworkManager.singleton;
        return manager != null;
    }
}
