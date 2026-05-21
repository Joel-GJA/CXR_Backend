# XR Presence Pipeline — Implementation Plan

## SDK / Framework Responsibility Analysis

This document breaks down every component of the XR rig sync pipeline and identifies
whether it is:

| Tag | Meaning |
|-----|---------|
| **SDK** | Provided by a popular SDK / framework — use as-is |
| **INFRA** | Custom infrastructure code (us) — this is what we build |
| **APP** | Application-level concern — left to individual project teams |

---

## Step 1 — XR Rig Prefab Architecture (✓ DONE)

### 1.1 Prefab hierarchy

| Component | Tag | Details |
|-----------|-----|---------|
| Root GameObject with NetworkIdentity | **INFRA** | Mirror standard — root-only NI convention |
| HeadRoot / LeftHandRoot / RightHandRoot transforms | **INFRA** | Standard hierarchy anchors |
| RigMount / AvatarVisualRoot | **INFRA** | Extension points for future avatars |
| Body visualization (Capsule) | **APP** | Placeholder — teams replace with their own avatar |

**SDK analysis:** No SDK provides a "networked XR rig" prefab — Mirror handles
networking primitives but the hierarchy composition is always project-specific.

---

### 1.2 NetworkTransform configuration

| Setting | Tag | Details |
|---------|-----|---------|
| `syncDirection = ClientToServer` | **SDK** (Mirror) | Mirror's built-in setting |
| `syncInterval = 0.05` (20 Hz) | **SDK** (Mirror) | Mirror's built-in setting |
| `positionPrecision = 0.001` | **SDK** (Mirror) | Mirror's NetworkTransformReliable |
| `interpolatePosition/Rotation = True` | **SDK** (Mirror) | Mirror's built-in interpolation |
| `onlySyncOnChange = True` | **SDK** (Mirror) | Mirror's built-in bandwidth saving |

**SDK analysis:** All of these are Mirror NetworkTransformReliable settings.
Infra only owns the *values* (conventions doc).

---

### 1.3 Rig lifecycle scripts

| Component | Tag | Details |
|-----------|-----|---------|
| `RuntimeParticipant` | **INFRA** (existing) | Extends RuntimeEntity, registers with session manager |
| `XRParticipantRuntime` | **INFRA** (new) | Local vs remote separation, proxy toggling |
| `RuntimeEntity` | **INFRA** (existing) | Owner NetID SyncVar, state machine |
| `RuntimeSessionManager` | **INFRA** (existing) | Participant tracking, disconnect cleanup |

**SDK analysis:** No multiplayer SDK provides "XR session lifecycle" —
Mirror gives connection lifecycle, but participant tracking and entity
ownership state are application/infrastructure concerns.

---

## Step 2 — XR Transform Synchronization (UP NEXT)

### 2.1 Reading XR device transforms

| Component | Tag | Details |
|-----------|-----|---------|
| Headset position/rotation | **SDK** (Unity OpenXR) | `TrackedPoseDriver` on XROrigin camera |
| Left controller position/rotation | **SDK** (Unity XRI) | `TrackedPoseDriver` on controller GameObject |
| Right controller position/rotation | **SDK** (Unity XRI) | `TrackedPoseDriver` on controller GameObject |
| Hand tracking joints (optional later) | **SDK** (Unity XR Hands) | `XRHandTrackingEvents` / `XRHandMeshController` |

**SDK analysis:** Unity's OpenXR + XR Interaction Toolkit already handles
ALL device tracking through `TrackedPoseDriver`. Meta SDK, SteamVR, and
other vendor SDKs also provide equivalent components.

We should NOT poll `InputTracking` or `XRNode` manually.

---

### 2.2 Bridging tracked poses to networked transforms

| Component | Tag | Details |
|-----------|-----|---------|
| `XRTrackingBridge` (proposed) | **INFRA** (to build) | Copies XR device transforms → NetworkTransform targets |
| LateUpdate loop | **INFRA** (to build) | Ensures poses flow after XR system updates |

**SDK analysis:** No SDK provides a generic "copy tracking to networked
transform" bridge — this is always a thin infrastructure layer specific
to your networking setup. However, `TrackedPoseDriver` itself handles
the actual device→Unity transform mapping. Our bridge just needs one
more hop: Unity transform → networked child transform.

**What the bridge does NOT need to do:**
- Poll XR devices (TrackedPoseDriver handles this)
- Apply any filtering/prediction (Mirror's interpolation handles remote smoothing)
- Handle coordinate spaces (XR Interaction Toolkit's XROrigin handles this)

---

### 2.3 Network synchronization of XR transforms

| Component | Tag | Details |
|-----------|-----|---------|
| Transform replication server→client | **SDK** (Mirror) | NetworkTransformReliable built-in |
| Client authority model | **SDK** (Mirror) | `syncDirection = ClientToServer` |
| Interpolation on remote clients | **SDK** (Mirror) | `interpolatePosition/Rotation = True` |
| Bandwidth optimization | **SDK** (Mirror) | `onlySyncOnChange`, `positionPrecision` |
| 20 Hz send rate | **SDK** (Mirror) | `syncInterval = 0.05` on NetworkTransform |

**SDK analysis:** 100% handled by Mirror. Infra only configures values.

---

## Step 3 — Local vs Remote Rig Separation

### 3.1 Local rig behavior

| Component | Tag | Details |
|-----------|-----|---------|
| Local XR camera enabled | **SDK** (Unity XRI) | XROrigin scene object handles this |
| XR input modules active | **SDK** (Unity XRI) | XR Interaction Manager handles this |
| Visual proxies hidden | **INFRA** (XRParticipantRuntime) | Proxy GameObjects toggled off |

**SDK analysis:** The scene's XROrigin (with Camera, controllers, interaction
system) is an **application concern** — each project places it in their scene.
Our prefab should NOT contain a Camera. Local rig visual suppression is our
infrastructure code.

---

### 3.2 Remote rig behavior

| Component | Tag | Details |
|-----------|-----|---------|
| Transforms driven by NetworkTransform | **SDK** (Mirror) | Automatic — no code needed |
| Visual proxies shown | **INFRA** (XRParticipantRuntime) | Proxy GameObjects toggled on |
| No camera / no input | **INFRA** (XRParticipantRuntime) | No camera = nothing to disable |

**SDK analysis:** Mirror handles network-driven transform updates. Proxy visual
management is infrastructure code.

---

### 3.3 The XROrigin relationship

| Component | Tag | Details |
|-----------|-----|---------|
| XROrigin in each team's scene | **APP** | Each project places their own XROrigin |
| Tracking origin alignment | **SDK** (Unity XRI) | XROrigin handles tracking space |
| Network rig reference for XRTrackingBridge | **INFRA** | Bridge needs to find local player's network rig |

**SDK analysis:** XROrigin is Unity's standard. The relationship between
the scene's XROrigin and the networked rig is infrastructure code.

---

## Step 4 — Spawn / Despawn Lifecycle

### 4.1 Spawn flow

| Component | Tag | Details |
|-----------|-----|---------|
| `NetworkManager.OnServerAddPlayer` | **SDK** (Mirror) | Mirror's default spawn hook |
| Player prefab instantiation | **SDK** (Mirror) | Mirror's NetworkManager |
| `NetworkServer.AddPlayerForConnection` | **SDK** (Mirror) | Mirror's built-in |
| `RuntimeParticipant.OnStartServer` | **INFRA** (existing) | Registers with session manager |
| `XRParticipantRuntime.OnStartLocalPlayer` | **INFRA** (new) | Configures local/remote mode |

**SDK analysis:** Mirror handles the entire spawn network lifecycle.
Infra code just hooks into the callbacks.

---

### 4.2 Despawn flow

| Component | Tag | Details |
|-----------|-----|---------|
| `NetworkManager.OnServerDisconnect` | **SDK** (Mirror) | Mirror's built-in disconnect |
| `RuntimeSessionManager.HandleClientDisconnect` | **INFRA** (existing) | Cleans up owned entities |
| Mirror player despawn | **SDK** (Mirror) | Automatic on disconnect |

**SDK analysis:** Mirror handles cleanup. Infra handles entity registry cleanup.

---

## Step 5 — Remote Visual Proxies

### 5.1 Proxy GameObjects

| Component | Tag | Details |
|-----------|-----|---------|
| Head proxy (sphere) | **INFRA** (done) | Placeholder visual — teams can replace |
| Hand proxies (spheres) | **INFRA** (done) | Placeholder visual — teams can replace |
| Body capsule | **INFRA** (done) | Placeholder — teams replace with avatar |

**SDK analysis:** No SDK provides "multiplayer XR presence proxies."
Meta's Avatar SDK could replace these, but that's an **application choice**
and adds significant complexity + platform lock-in. The doc explicitly says
"NOT advanced avatars, IK systems, facial tracking."

---

## Step 6 — XR Rig Spawn Registration

### 6.1 Prefab registration

| Component | Tag | Details |
|-----------|-----|---------|
| Spawn prefab list in NetworkManager | **SDK** (Mirror) | Mirror's built-in spawn prefab registration |
| `playerPrefab` assignment | **SDK** (Mirror) | Mirror's NetworkManager field |

**SDK analysis:** Mirror handles this. Infra just sets the field.

---

## Step 7 — Stress Testing & Standards

### 7.1 Validation

| Component | Tag | Details |
|-----------|-----|---------|
| Multi-client join/leave | **SDK** (Mirror) + **INFRA** | Mirror provides transport; we validate behavior |
| Transform sync consistency | **SDK** (Mirror) | NetworkTransformReliable handles sync; we verify settings |
| Reconnect behavior | **INFRA** | Session manager cleanup correctness |
| Debug logging `[XR_PRESENCE]` | **INFRA** | Convention we enforce |

**SDK analysis:** Testing methodology is infrastructure. Tools like Mirror's
`NetworkBenchmark` scene exist but don't cover XR-specific scenarios.

---

## Summary: What We Actually Build

| Infra Component | Lines of Code | Replaces What SDK Would Do |
|-----------------|---------------|---------------------------|
| `XRParticipantRuntime` | ~80 | Nothing — SDKs don't manage networked rig lifecycle |
| `XRTrackingBridge` (proposed) | ~60 | Nothing — SDKs track but don't bridge to Mirror |
| Prefab hierarchy | Unity asset | Nothing — SDKs don't provide multiplayer XR prefabs |
| NetworkTransform config | Values in prefab | Mirror provides components; we set convention values |

**Everything critical is already SDK-provided.** Our infrastructure is thin
orchestration code — ~140 lines total for the two main scripts.

---

## What App Teams Still Own

| Concern | SDK They Use |
|---------|-------------|
| XROrigin + Camera placement | Unity XR Interaction Toolkit |
| XR Controller models (controller meshes) | Unity XRI / Meta SDK / SteamVR |
| Avatar system (if any) | Any — our prefab accepts AvatarVisualRoot |
| Interaction (grab, teleport, UI) | Unity XR Interaction Toolkit |
| Scene content | Their own |
| Meta Platform SDK features (if desired) | Meta SDK (optional, app choice) |

---

## Potential SDK Replacements to Watch

| Our Infra Component | Could Be Replaced By | Trade-off |
|--------------------|---------------------|-----------|
| Remote proxies (spheres) | Meta Avatars SDK | Adds Meta dependency, complex setup, heavy |
| Remote proxies (spheres) | Ready Player Me + glTF | Adds HTTP dependency, not LAN-friendly |
| `XRTrackingBridge` | Unity's `TrackedPoseDriver` directly on our transforms | NOT possible — TPD drives render-side, not network-authority transforms |
| NetworkTransformReliable | Mirror's NetworkTransformUnreliable | Worse sync quality (packet loss on LAN is rare anyway) |
| Session management | Mirror's built-in room system | Already using it — our `RuntimeSessionManager` extends it with entity tracking |
