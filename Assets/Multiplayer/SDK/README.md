# CXR LAN Discovery SDK

This repository is a Unity package that provides a lightweight LAN discovery layer for Mirror-based multiplayer XR applications. It focuses on room visibility, metadata, room browser workflows, and join initiation.

The SDK intentionally does not implement gameplay networking, synchronization, orchestration, or matchmaking. Mirror remains responsible for runtime networking and object replication.

## Package Layout

- `Runtime/`: SDK runtime code.
- `Samples~/RoomBrowserExample/`: sample scripts for a room browser client and a simple host/headless server setup.
- `Documentation/`: setup, architecture, and LAN testing guides.
- `Tests/Editor/`: registry lifecycle tests.

## Core Public API

```csharp
using CXR.SDK;

CXRSDK.Initialize();
CXRSDK.RefreshRooms();

var rooms = CXRSDK.GetRooms();

if (rooms.Count > 0)
{
    CXRSDK.JoinRoom(rooms[0].RoomId);
}
```

## Mirror Integration Notes

Install Mirror and Mirror Discovery in your Unity project before importing this package. The SDK is designed to sit on top of those packages rather than replace them.

Use `DiscoveryManager` on client/browser flows.

Use `DiscoveryListener` plus `DiscoveryBroadcaster` on host or dedicated server flows.
