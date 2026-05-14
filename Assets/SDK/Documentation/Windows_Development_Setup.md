# Windows Development Setup

## Workspace Rule

Keep all SDK work inside:

`D:\CXR Main Backend\CXR_SDK`

This repository was structured so the package root, sample scripts, documentation, and tests all live inside that directory only.

## Suggested Local Folder Usage

- package source: `D:\CXR Main Backend\CXR_SDK`
- Unity project under test: any Unity project that references the package by local path
- logs: keep runtime logs inside your Unity project or a sibling `D:` path that you control

## Unity Version

Recommended baseline:

- Unity `2022.3 LTS` or newer

## Required Packages In The Consumer Project

- Mirror Networking
- Mirror Discovery
- KCP Transport or another compatible Mirror transport

## Local Package Reference

Add the SDK to the Unity project manifest with:

```json
{
  "dependencies": {
    "com.cxr.lan-discovery-sdk": "file:D:/CXR Main Backend/CXR_SDK"
  }
}
```

## Recommended Local Test Setup

### Client Browser Scene

- `DiscoveryManager`
- sample UI scripts if you want the provided browser workflow

### Host Scene

- `NetworkManager`
- KCP transport
- `DiscoveryListener`
- `DiscoveryBroadcaster`

### Dedicated Server Build

- same host scene content
- `SampleHeadlessServerLauncher`
- launch with `-batchmode -nographics`

## Operational Notes

- Use `Explicit Port` on `DiscoveryBroadcaster` if your transport does not expose a readable port field or property.
- Keep the SDK focused on discovery and join initiation. Let Mirror own runtime networking.
- Tune `refreshIntervalSeconds` and `staleTimeoutSeconds` on `DiscoveryManager` for your LAN environment.
