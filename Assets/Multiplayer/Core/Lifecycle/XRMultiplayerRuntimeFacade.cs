using System.Collections.Generic;
using CXR.SDK.Rooms;
using Mirror;
using UnityEngine;

[AddComponentMenu("CXR Multiplayer/Runtime Facade")]
[DisallowMultipleComponent]
public sealed class XRMultiplayerRuntimeFacade : MonoBehaviour
{
    [Header("Runtime References")]
    [SerializeField]
    private XRNetworkManager networkManager;

    [SerializeField]
    private XRRoomDiscoveryLifecycle discoveryLifecycle;

    [SerializeField]
    private RemoteRoomRegistryBrowser remoteRoomRegistryBrowser;

    [SerializeField]
    private bool autoResolveReferences = true;

    [SerializeField]
    private string defaultClientAddress = "localhost";

    private readonly XRRoomBrowserModel roomBrowser =
        new XRRoomBrowserModel();

    public XRRoomBrowserModel RoomBrowser => roomBrowser;

    public IReadOnlyList<RoomInfo> VisibleRooms =>
        remoteRoomRegistryBrowser != null &&
        remoteRoomRegistryBrowser.VisibleRooms.Count > 0
            ? remoteRoomRegistryBrowser.VisibleRooms
            : roomBrowser.VisibleRooms;

    public XRConnectionLifecycle ConnectionState => ResolveConnectionState();

    public bool IsServerActive => NetworkServer.active;

    public bool IsClientConnected => NetworkClient.isConnected;

    public bool IsClientConnecting =>
        NetworkClient.active && !NetworkClient.isConnected;

    public bool IsDiscoveryAvailable => discoveryLifecycle != null;

    public bool IsRemoteRegistryAvailable =>
        remoteRoomRegistryBrowser != null &&
        remoteRoomRegistryBrowser.HasRegistry;

    public string RemoteRegistryUrl
    {
        get => remoteRoomRegistryBrowser != null
            ? remoteRoomRegistryBrowser.RegistryUrl
            : string.Empty;
        set
        {
            ResolveReferences();

            if (remoteRoomRegistryBrowser != null)
            {
                remoteRoomRegistryBrowser.RegistryUrl = value;
            }
        }
    }

    public int RemoteRoomCount =>
        remoteRoomRegistryBrowser != null
            ? remoteRoomRegistryBrowser.VisibleRooms.Count
            : 0;

    public string RemoteRegistryLastError =>
        remoteRoomRegistryBrowser != null
            ? remoteRoomRegistryBrowser.LastError
            : string.Empty;

    public float RemoteRegistryLastRefreshTime =>
        remoteRoomRegistryBrowser != null
            ? remoteRoomRegistryBrowser.LastRefreshTime
            : -1f;

    public RuntimeSessionState SessionState =>
        SessionManager != null
            ? SessionManager.State
            : RuntimeSessionState.WaitingForParticipants;

    public int ParticipantCount =>
        SessionManager != null ? SessionManager.ParticipantCount : 0;

    public int TrackedParticipantCount =>
        SessionManager != null ? SessionManager.ParticipantInfos.Count : 0;

    public int ConnectedClientCount =>
        networkManager != null ? networkManager.GetConnectedClientCount() : 0;

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
        ActiveNetworkManager != null
            ? ActiveNetworkManager.networkAddress
            : string.Empty;

    private RuntimeSessionManager SessionManager =>
        networkManager != null ? networkManager.SessionManager : null;

    private NetworkManager ActiveNetworkManager =>
        networkManager != null
            ? networkManager
            : NetworkManager.singleton;

    private void Awake()
    {
        ResolveReferences();
        SyncRoomBrowser();
    }

    private void OnEnable()
    {
        ResolveReferences();
        SubscribeDiscovery();
        SubscribeRemoteRegistry();
        SyncRoomBrowser();
    }

    private void OnDisable()
    {
        UnsubscribeDiscovery();
        UnsubscribeRemoteRegistry();
    }

    private void Update()
    {
        if (autoResolveReferences)
        {
            ResolveReferences();
        }

        SyncRoomBrowser();
    }

    public void StartHost()
    {
        NetworkManager manager = ActiveNetworkManager;
        if (manager == null)
        {
            return;
        }

        EnsureActiveTransport(manager);
        manager.StartHost();
    }

    public void StartServer()
    {
        NetworkManager manager = ActiveNetworkManager;
        if (manager == null)
        {
            return;
        }

        EnsureActiveTransport(manager);
        manager.StartServer();
    }

    public void StartClient(string address)
    {
        NetworkManager manager = ActiveNetworkManager;
        if (manager == null)
        {
            return;
        }

        string resolvedAddress = string.IsNullOrWhiteSpace(address)
            ? defaultClientAddress
            : address.Trim();

        if (!string.IsNullOrWhiteSpace(resolvedAddress))
        {
            manager.networkAddress = resolvedAddress;
        }

        EnsureActiveTransport(manager);
        manager.StartClient();
    }

    public void RefreshRooms()
    {
        ResolveReferences();

        if (discoveryLifecycle != null)
        {
            discoveryLifecycle.RefreshRooms();
            SyncRoomBrowser();
        }

        if (remoteRoomRegistryBrowser != null &&
            remoteRoomRegistryBrowser.HasRegistry)
        {
            remoteRoomRegistryBrowser.RefreshRooms();
        }
    }

    public void RefreshRemoteRooms()
    {
        ResolveReferences();

        if (remoteRoomRegistryBrowser != null)
        {
            remoteRoomRegistryBrowser.RefreshRooms();
        }
    }

    public void StartDiscovery()
    {
        ResolveReferences();

        if (discoveryLifecycle != null)
        {
            discoveryLifecycle.StartDiscovery();
            SyncRoomBrowser();
        }
    }

    public void StopDiscovery()
    {
        if (discoveryLifecycle != null)
        {
            discoveryLifecycle.StopDiscovery();
            SyncRoomBrowser();
        }
    }

    public bool JoinRoom(string roomId, out string error)
    {
        error = string.Empty;
        ResolveReferences();

        if (discoveryLifecycle == null)
        {
            if (remoteRoomRegistryBrowser == null)
            {
                error = "Discovery lifecycle and remote registry are unavailable.";
                return false;
            }
        }

        if (remoteRoomRegistryBrowser != null &&
            remoteRoomRegistryBrowser.GetRoomById(roomId) != null)
        {
            bool remoteJoined =
                remoteRoomRegistryBrowser.JoinRoom(roomId, out error);
            SyncRoomBrowser();
            return remoteJoined;
        }

        bool joined = discoveryLifecycle != null &&
            discoveryLifecycle.JoinRoom(roomId, out error);
        SyncRoomBrowser();
        return joined;
    }

    public void Stop()
    {
        NetworkManager manager = ActiveNetworkManager;
        if (manager == null)
        {
            return;
        }

        if (NetworkServer.active && NetworkClient.isConnected)
        {
            manager.StopHost();
            return;
        }

        if (NetworkClient.active)
        {
            manager.StopClient();
        }

        if (NetworkServer.active)
        {
            manager.StopServer();
        }
    }

    public void StopClient()
    {
        ActiveNetworkManager?.StopClient();
    }

    public RoomInfo GetRoomById(string roomId)
    {
        ResolveReferences();

        RoomInfo remoteRoom = remoteRoomRegistryBrowser != null
            ? remoteRoomRegistryBrowser.GetRoomById(roomId)
            : null;

        if (remoteRoom != null)
        {
            return remoteRoom;
        }

        return discoveryLifecycle != null
            ? discoveryLifecycle.GetRoomById(roomId)
            : null;
    }

    public void ResolveReferences()
    {
        if (!autoResolveReferences)
        {
            return;
        }

        if (networkManager == null)
        {
            networkManager =
                NetworkManager.singleton as XRNetworkManager ??
                FindObjectOfType<XRNetworkManager>();
        }

        XRRoomDiscoveryLifecycle previousLifecycle = discoveryLifecycle;
        RemoteRoomRegistryBrowser previousRemoteRegistry =
            remoteRoomRegistryBrowser;

        if (discoveryLifecycle == null)
        {
            discoveryLifecycle = GetComponent<XRRoomDiscoveryLifecycle>();
        }

        if (discoveryLifecycle == null)
        {
            discoveryLifecycle = FindObjectOfType<XRRoomDiscoveryLifecycle>();
        }

        if (remoteRoomRegistryBrowser == null)
        {
            remoteRoomRegistryBrowser =
                GetComponent<RemoteRoomRegistryBrowser>();
        }

        if (remoteRoomRegistryBrowser == null)
        {
            remoteRoomRegistryBrowser =
                FindObjectOfType<RemoteRoomRegistryBrowser>();
        }

        if (previousLifecycle != discoveryLifecycle)
        {
            if (previousLifecycle != null)
            {
                previousLifecycle.RoomsChanged -= HandleRoomsChanged;
                previousLifecycle.StateChanged -= HandleDiscoveryStateChanged;
            }

            SubscribeDiscovery();
        }

        if (previousRemoteRegistry != remoteRoomRegistryBrowser)
        {
            if (previousRemoteRegistry != null)
            {
                previousRemoteRegistry.RoomsChanged -=
                    HandleRemoteRoomsChanged;
                previousRemoteRegistry.RefreshFailed -=
                    HandleRemoteRefreshFailed;
            }

            SubscribeRemoteRegistry();
        }
    }

    private void SubscribeDiscovery()
    {
        if (discoveryLifecycle == null)
        {
            return;
        }

        discoveryLifecycle.RoomsChanged -= HandleRoomsChanged;
        discoveryLifecycle.StateChanged -= HandleDiscoveryStateChanged;
        discoveryLifecycle.RoomsChanged += HandleRoomsChanged;
        discoveryLifecycle.StateChanged += HandleDiscoveryStateChanged;
    }

    private void UnsubscribeDiscovery()
    {
        if (discoveryLifecycle == null)
        {
            return;
        }

        discoveryLifecycle.RoomsChanged -= HandleRoomsChanged;
        discoveryLifecycle.StateChanged -= HandleDiscoveryStateChanged;
    }

    private void SubscribeRemoteRegistry()
    {
        if (remoteRoomRegistryBrowser == null)
        {
            return;
        }

        remoteRoomRegistryBrowser.RoomsChanged -= HandleRemoteRoomsChanged;
        remoteRoomRegistryBrowser.RefreshFailed -= HandleRemoteRefreshFailed;
        remoteRoomRegistryBrowser.RoomsChanged += HandleRemoteRoomsChanged;
        remoteRoomRegistryBrowser.RefreshFailed += HandleRemoteRefreshFailed;
    }

    private void UnsubscribeRemoteRegistry()
    {
        if (remoteRoomRegistryBrowser == null)
        {
            return;
        }

        remoteRoomRegistryBrowser.RoomsChanged -= HandleRemoteRoomsChanged;
        remoteRoomRegistryBrowser.RefreshFailed -= HandleRemoteRefreshFailed;
    }

    private void HandleRoomsChanged(IReadOnlyList<RoomInfo> rooms)
    {
        SyncRoomBrowser();
    }

    private void HandleDiscoveryStateChanged(
        XRRoomDiscoveryLifecycleState state)
    {
        SyncRoomBrowser();
    }

    private void HandleRemoteRoomsChanged(IReadOnlyList<RoomInfo> rooms)
    {
        SyncRoomBrowser();
    }

    private void HandleRemoteRefreshFailed(string error)
    {
        SyncRoomBrowser();
    }

    private void SyncRoomBrowser()
    {
        roomBrowser.SyncFrom(discoveryLifecycle);
    }

    private static void EnsureActiveTransport(NetworkManager manager)
    {
        if (Transport.active == null && manager.transport != null)
        {
            Transport.active = manager.transport;
        }
    }

    private static XRConnectionLifecycle ResolveConnectionState()
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
