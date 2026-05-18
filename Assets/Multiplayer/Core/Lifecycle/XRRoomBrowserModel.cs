using System.Collections.Generic;
using CXR.SDK.Rooms;

public sealed class XRRoomBrowserModel
{
    private readonly List<RoomInfo> visibleRooms = new List<RoomInfo>();

    public IReadOnlyList<RoomInfo> VisibleRooms => visibleRooms;

    public XRRoomDiscoveryLifecycleState DiscoveryState { get; private set; }

    public string LastError { get; private set; } = string.Empty;

    public float LastRefreshTime { get; private set; } = -1f;

    public int VisibleRoomCount => visibleRooms.Count;

    public void SyncFrom(XRRoomDiscoveryLifecycle lifecycle)
    {
        visibleRooms.Clear();

        if (lifecycle == null)
        {
            DiscoveryState = XRRoomDiscoveryLifecycleState.Idle;
            LastError = "Discovery lifecycle is unavailable.";
            LastRefreshTime = -1f;
            return;
        }

        DiscoveryState = lifecycle.State;
        LastError = lifecycle.LastError;
        LastRefreshTime = lifecycle.LastRefreshTime;

        IReadOnlyList<RoomInfo> rooms = lifecycle.VisibleRooms;
        for (int index = 0; index < rooms.Count; index++)
        {
            if (rooms[index] != null)
            {
                visibleRooms.Add(rooms[index]);
            }
        }
    }
}
