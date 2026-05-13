using Mirror;
using UnityEngine;

public class XRNetworkManager : NetworkManager
{
    public override void OnStartServer()
    {
        Debug.Log("[SERVER] Server Started");
    }

    public override void OnStopServer()
    {
        Debug.Log("[SERVER] Server Stopped");
    }

    public override void OnServerConnect(NetworkConnectionToClient conn)
    {
        Debug.Log($"[SERVER] Client Connected: {conn.connectionId}");
    }

    public override void OnServerDisconnect(NetworkConnectionToClient conn)
    {
        Debug.Log($"[SERVER] Client Disconnected: {conn.connectionId}");

        base.OnServerDisconnect(conn);
    }

    public override void OnClientConnect()
    {
        Debug.Log("[CLIENT] Connected To Server");
    }

    public override void OnClientDisconnect()
    {
        Debug.Log("[CLIENT] Disconnected From Server");
    }
}