using System;
using System.Collections.Generic;
using CXR.SDK.Discovery;
using CXR.SDK.Rooms;
using UnityEngine;

[DisallowMultipleComponent]
public sealed class XRRoomDiscoveryLifecycle : MonoBehaviour
{
    [Header("Discovery Runtime")]
    [SerializeField]
    private DiscoveryManager discoveryManager;

    [SerializeField]
    private bool initializeOnAwake = true;

    [SerializeField]
    private bool autoCreateDiscoveryManager = true;

    [SerializeField]
    private bool refreshOnInitialize = true;

    [SerializeField]
    private float refreshResultGraceSeconds = 0.5f;

    [Header("Lifecycle Snapshot")]
    [SerializeField]
    private XRRoomDiscoveryLifecycleState state =
        XRRoomDiscoveryLifecycleState.Idle;

    [SerializeField]
    private string lastError = string.Empty;

    [SerializeField]
    private float lastRefreshTime = -1f;

    [SerializeField]
    private int visibleRoomCount;

    private readonly List<RoomInfo> visibleRooms = new List<RoomInfo>();
    private bool subscribed;

    public event Action<XRRoomDiscoveryLifecycleState> StateChanged;

    public event Action<IReadOnlyList<RoomInfo>> RoomsChanged;

    public event Action<RoomInfo> JoinStarted;

    public event Action<RoomInfo> JoinSucceeded;

    public event Action<RoomInfo, string> JoinFailed;

    public XRRoomDiscoveryLifecycleState State => state;

    public string LastError => lastError;

    public float LastRefreshTime => lastRefreshTime;

    public int VisibleRoomCount => visibleRoomCount;

    public IReadOnlyList<RoomInfo> VisibleRooms => visibleRooms;

    public DiscoveryManager DiscoveryManager => discoveryManager;

    private void Awake()
    {
        ResolveDiscoveryManager();

        if (initializeOnAwake)
        {
            Initialize();
        }
    }

    private void OnEnable()
    {
        Subscribe();
    }

    private void OnDisable()
    {
        Unsubscribe();
    }

    private void Update()
    {
        if (state != XRRoomDiscoveryLifecycleState.Refreshing)
        {
            return;
        }

        if (lastRefreshTime < 0f ||
            Time.unscaledTime - lastRefreshTime < refreshResultGraceSeconds)
        {
            return;
        }

        SyncFromDiscoveryManager();
    }

    public void Initialize()
    {
        SetState(XRRoomDiscoveryLifecycleState.Initializing);
        ClearError();
        ResolveDiscoveryManager();

        if (discoveryManager == null)
        {
            Fail("DiscoveryManager was not found and could not be created.");
            return;
        }

        Subscribe();
        discoveryManager.Initialize();
        SyncRooms(discoveryManager.GetRooms());

        if (refreshOnInitialize)
        {
            RefreshRooms();
            return;
        }

        SetRoomListState();
    }

    public void RefreshRooms()
    {
        ClearError();
        ResolveDiscoveryManager();

        if (discoveryManager == null)
        {
            Fail("DiscoveryManager is unavailable.");
            return;
        }

        Subscribe();
        lastRefreshTime = Time.unscaledTime;
        SetState(XRRoomDiscoveryLifecycleState.Refreshing);
        discoveryManager.RefreshRooms();
    }

    public void StartDiscovery()
    {
        Initialize();
        RefreshRooms();
    }

    public void StopDiscovery()
    {
        if (discoveryManager != null)
        {
            discoveryManager.Shutdown();
        }

        visibleRooms.Clear();
        visibleRoomCount = 0;
        RoomsChanged?.Invoke(visibleRooms);
        SetState(XRRoomDiscoveryLifecycleState.Stopped);
    }

    public bool JoinRoom(string roomId)
    {
        return JoinRoom(roomId, out _);
    }

    public bool JoinRoom(string roomId, out string error)
    {
        error = string.Empty;
        ClearError();
        ResolveDiscoveryManager();

        if (discoveryManager == null)
        {
            error = "DiscoveryManager is unavailable.";
            Fail(error);
            JoinFailed?.Invoke(null, error);
            return false;
        }

        RoomInfo room = discoveryManager.GetRoomById(roomId);
        if (room == null)
        {
            error = "Selected room was not found.";
            Fail(error);
            JoinFailed?.Invoke(null, error);
            return false;
        }

        SetState(XRRoomDiscoveryLifecycleState.Joining);
        JoinStarted?.Invoke(room);

        bool joined = discoveryManager.JoinRoom(roomId, out error);
        if (!joined)
        {
            Fail(error);
            JoinFailed?.Invoke(room, error);
            return false;
        }

        SetState(XRRoomDiscoveryLifecycleState.Joined);
        JoinSucceeded?.Invoke(room);
        return true;
    }

    public RoomInfo GetRoomById(string roomId)
    {
        ResolveDiscoveryManager();
        return discoveryManager != null
            ? discoveryManager.GetRoomById(roomId)
            : null;
    }

    public void SyncFromDiscoveryManager()
    {
        ResolveDiscoveryManager();

        if (discoveryManager == null)
        {
            visibleRooms.Clear();
            visibleRoomCount = 0;
            return;
        }

        SyncRooms(discoveryManager.GetRooms());
        SetRoomListState();
    }

    private void ResolveDiscoveryManager()
    {
        if (discoveryManager != null)
        {
            return;
        }

        discoveryManager = GetComponent<DiscoveryManager>();

        if (discoveryManager == null)
        {
            discoveryManager = FindObjectOfType<DiscoveryManager>();
        }

        if (discoveryManager == null && autoCreateDiscoveryManager)
        {
            discoveryManager = gameObject.AddComponent<DiscoveryManager>();
        }
    }

    private void Subscribe()
    {
        if (subscribed || discoveryManager == null)
        {
            return;
        }

        discoveryManager.RoomsChanged += HandleRoomsChanged;
        subscribed = true;
    }

    private void Unsubscribe()
    {
        if (!subscribed || discoveryManager == null)
        {
            return;
        }

        discoveryManager.RoomsChanged -= HandleRoomsChanged;
        subscribed = false;
    }

    private void HandleRoomsChanged(IReadOnlyList<RoomInfo> rooms)
    {
        SyncRooms(rooms);
        SetRoomListState();
    }

    private void SyncRooms(IReadOnlyList<RoomInfo> rooms)
    {
        visibleRooms.Clear();

        if (rooms != null)
        {
            for (int index = 0; index < rooms.Count; index++)
            {
                if (rooms[index] != null)
                {
                    visibleRooms.Add(rooms[index]);
                }
            }
        }

        visibleRoomCount = visibleRooms.Count;
        RoomsChanged?.Invoke(visibleRooms);
    }

    private void SetRoomListState()
    {
        if (state == XRRoomDiscoveryLifecycleState.Joining ||
            state == XRRoomDiscoveryLifecycleState.Joined ||
            state == XRRoomDiscoveryLifecycleState.Failed ||
            state == XRRoomDiscoveryLifecycleState.Stopped)
        {
            return;
        }

        SetState(visibleRoomCount > 0
            ? XRRoomDiscoveryLifecycleState.RoomsAvailable
            : XRRoomDiscoveryLifecycleState.NoRooms);
    }

    private void Fail(string error)
    {
        lastError = string.IsNullOrWhiteSpace(error)
            ? "Unknown discovery lifecycle failure."
            : error;

        SetState(XRRoomDiscoveryLifecycleState.Failed);
    }

    private void ClearError()
    {
        lastError = string.Empty;
    }

    private void SetState(XRRoomDiscoveryLifecycleState nextState)
    {
        if (state == nextState)
        {
            return;
        }

        state = nextState;
        StateChanged?.Invoke(state);
    }
}
