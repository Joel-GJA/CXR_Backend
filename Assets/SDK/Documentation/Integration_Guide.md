# Unity Integration Guide

## 1. Add the Package

Place this package at `D:\CXR Main Backend\CXR_SDK` and add it to your Unity project using a local package reference.

Example `manifest.json` entry:

```json
{
  "dependencies": {
    "com.cxr.lan-discovery-sdk": "file:D:/CXR Main Backend/CXR_SDK"
  }
}
```

## 2. Install Mirror

Install:

- Mirror Networking
- Mirror Discovery
- your preferred Mirror transport, such as KCP

The SDK expects Mirror to own networking, transport, and replication.

## 3. Client Browser Setup

Create a bootstrap object in your client scene and add:

- `DiscoveryManager`

Optional:

- `SampleRoomBrowserBootstrap`
- `SampleRoomBrowserUI`

The manager auto-adds `DiscoveryListener` and `JoinRoomHandler` if they are missing.

## 4. Host or Dedicated Server Setup

Create a server object in your gameplay or headless scene and add:

- `NetworkManager`
- your active Mirror transport
- `DiscoveryListener`
- `DiscoveryBroadcaster`

Optional sample helpers:

- `SampleRoomServerMetadata`
- `SampleHeadlessServerLauncher`

## 5. Configure DiscoveryBroadcaster

Set:

- `Room Name`
- `Status`
- `Max Players`
- `Explicit Port` if automatic port detection is not available for your transport
- optional metadata entries using `SetMetadata(...)` at runtime

## 6. Use the SDK API

Interact with the SDK through `DiscoveryManager`. Attach it to a GameObject in your scene (it self-configures on Awake):

```csharp
using CXR.SDK.Discovery;

public sealed class RoomBrowserController : MonoBehaviour
{
    [SerializeField] private DiscoveryManager discoveryManager;

    private void Start()
    {
        if (discoveryManager == null)
            discoveryManager = FindObjectOfType<DiscoveryManager>();

        discoveryManager.Initialize();
        discoveryManager.RefreshRooms();
    }

    public void JoinFirstVisibleRoom()
    {
        var rooms = discoveryManager.GetRooms();
        if (rooms.Count > 0)
        {
            discoveryManager.JoinRoom(rooms[0].RoomId);
        }
    }
}
```

## 7. Recommended Mirror Ownership Boundary

Keep these responsibilities separate:

- SDK: discovery, metadata, visibility, room list, join initiation
- Mirror: transport, connection state, synchronization, authority, spawning, RPCs
