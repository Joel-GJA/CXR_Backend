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
    private string defaultClientAddress = "localhost";

    private XRConnectionStateProvider connectionStateProvider;

    private readonly XRRoomBrowserModel roomBrowser =
        new XRRoomBrowserModel();

    public XRRoomBrowserModel RoomBrowser => roomBrowser;

    public IReadOnlyList<RoomInfo> VisibleRooms =>
        remoteRoomRegistryBrowser != null &&
        remoteRoomRegistryBrowser.VisibleRooms.Count > 0
            ? remoteRoomRegistryBrowser.VisibleRooms
            : roomBrowser.VisibleRooms;

    public XRConnectionLifecycle ConnectionState =>
        connectionStateProvider.ConnectionState;

    public bool IsServerActive => connectionStateProvider.IsServerActive;

    public bool IsClientConnected => connectionStateProvider.IsClientConnected;

    public bool IsClientConnecting =>
        connectionStateProvider.IsClientConnecting;

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
            if (remoteRoomRegistryBrowser != null)
            {
                remoteRoomRegistryBrowser.RegistryUrl = value;
            }

            RemoteRoomRegistryPublisher publisher =
                GetComponent<RemoteRoomRegistryPublisher>() ??
                FindObjectOfType<RemoteRoomRegistryPublisher>();

            if (publisher != null)
            {
                publisher.RegistryUrl = value;
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

    public long RemoteRegistryLastResponseCode =>
        remoteRoomRegistryBrowser != null
            ? remoteRoomRegistryBrowser.LastResponseCode
            : -1;

    public int RemoteRegistryLastResponseBytes =>
        remoteRoomRegistryBrowser != null
            ? remoteRoomRegistryBrowser.LastResponseBytes
            : 0;

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
        connectionStateProvider.ConnectedClientCount;

    public uint LocalPlayerNetId =>
        connectionStateProvider.LocalPlayerNetId;

    public int LocalConnectionId =>
        connectionStateProvider.LocalConnectionId;

    public string NetworkAddress =>
        connectionStateProvider.NetworkAddress;

    private RuntimeSessionManager SessionManager =>
        networkManager != null ? networkManager.SessionManager : null;

    public void Initialize(XRConnectionStateProvider provider)
    {
        connectionStateProvider = provider;
    }

    private void Awake()
    {
        connectionStateProvider = new XRConnectionStateProvider();
        TryResolveNetworkManager();
        TryResolveDiscoveryLifecycle();
        TryResolveRemoteRegistryBrowser();
        SyncRoomBrowser();
    }

    private void TryResolveDiscoveryLifecycle()
    {
        if (discoveryLifecycle != null)
            return;

        discoveryLifecycle = GetComponent<XRRoomDiscoveryLifecycle>() ??
                             FindObjectOfType<XRRoomDiscoveryLifecycle>();

        if (discoveryLifecycle == null)
        {
            discoveryLifecycle = gameObject.AddComponent<XRRoomDiscoveryLifecycle>();
            Debug.Log("[FACADE] Auto-created XRRoomDiscoveryLifecycle");
        }
    }

    private void TryResolveRemoteRegistryBrowser()
    {
        if (remoteRoomRegistryBrowser != null)
            return;

        remoteRoomRegistryBrowser = GetComponent<RemoteRoomRegistryBrowser>() ??
                                     FindObjectOfType<RemoteRoomRegistryBrowser>();

        if (remoteRoomRegistryBrowser == null)
        {
            remoteRoomRegistryBrowser = gameObject.AddComponent<RemoteRoomRegistryBrowser>();
            Debug.Log("[FACADE] Auto-created RemoteRoomRegistryBrowser");
        }
    }

    private void TryResolveNetworkManager()
    {
        if (networkManager != null)
        {
            return;
        }

        if (connectionStateProvider.TryGetActiveNetworkManager(
                out var manager))
        {
            networkManager = manager as XRNetworkManager;
        }
    }

    private void OnEnable()
    {
        SubscribeDiscovery();
        SubscribeRemoteRegistry();
        SyncRoomBrowser();
    }

    private void OnDisable()
    {
        UnsubscribeDiscovery();
        UnsubscribeRemoteRegistry();
    }

    public void StartHost()
    {
        TryResolveNetworkManager();

        if (networkManager == null)
        {
            return;
        }

        EnsureActiveTransport(networkManager);
        networkManager.StartHost();
        PublishRoomToRegistry();
    }

    public void StartServer()
    {
        TryResolveNetworkManager();

        if (networkManager == null)
        {
            return;
        }

        EnsureActiveTransport(networkManager);
        networkManager.StartServer();
        PublishRoomToRegistry();
    }

    public void StartClient(string address)
    {
        TryResolveNetworkManager();

        if (networkManager == null)
        {
            return;
        }

        string resolvedAddress = string.IsNullOrWhiteSpace(address)
            ? defaultClientAddress
            : address.Trim();

        if (!string.IsNullOrWhiteSpace(resolvedAddress))
        {
            networkManager.networkAddress = resolvedAddress;
        }

        EnsureActiveTransport(networkManager);
        networkManager.StartClient();
    }

    public void RefreshRooms()
    {
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
        if (remoteRoomRegistryBrowser != null)
        {
            remoteRoomRegistryBrowser.RefreshRooms();
        }
    }

    public void StartDiscovery()
    {
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

        if (discoveryLifecycle == null && remoteRoomRegistryBrowser == null)
        {
            error = "Discovery lifecycle and remote registry are unavailable.";
            return false;
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
        TryResolveNetworkManager();

        if (networkManager == null)
        {
            return;
        }

        if (connectionStateProvider.IsServerActive &&
            connectionStateProvider.IsClientConnected)
        {
            networkManager.StopHost();
            return;
        }

        if (connectionStateProvider.IsClientConnected)
        {
            networkManager.StopClient();
        }

        if (connectionStateProvider.IsServerActive)
        {
            networkManager.StopServer();
        }
    }

    public void StopClient()
    {
        TryResolveNetworkManager();
        networkManager?.StopClient();
    }

    public RoomInfo GetRoomById(string roomId)
    {
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

    public void PublishRoomToRegistry()
    {
        RemoteRoomRegistryPublisher publisher =
            GetComponent<RemoteRoomRegistryPublisher>() ??
            FindObjectOfType<RemoteRoomRegistryPublisher>();

        if (publisher == null)
        {
            return;
        }

        if (string.IsNullOrWhiteSpace(publisher.RegistryUrl) &&
            remoteRoomRegistryBrowser != null &&
            !string.IsNullOrWhiteSpace(remoteRoomRegistryBrowser.RegistryUrl))
        {
            publisher.RegistryUrl = remoteRoomRegistryBrowser.RegistryUrl;
        }

        publisher.PublishNow();
    }

    private static void EnsureActiveTransport(NetworkManager manager)
    {
        if (Transport.active == null && manager.transport != null)
        {
            Transport.active = manager.transport;
        }
    }
}
