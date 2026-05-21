# XR Presence Pipeline — Consolidated Plan

> Merges `SeperationOfConcern.md` architecture vision with current Phase 2 implementation.
> Contradictions flagged with ⚠️; relevant context adopted with ✅.

---

## 1. Overall Architecture

### Adopted ✅ — Three-Layer Split

```text
CXR Core           → platform-agnostic (RuntimeSessionManager, RuntimeEntity, etc.)
CXR XR Package     → XR-specific (our prefab, XRParticipantRuntime, XRTrackingBridge)
CXR Desktop Package → Future (not in scope for Phase 2)
```

**Our mapping:**
| Doc's Layer | Our Code |
|-------------|----------|
| Core Runtime | `RuntimeParticipant`, `RuntimeEntity`, `RuntimeSessionManager`, `RuntimeEntityRegistry` |
| XR Package | `XRRuntimeParticipantRoot` prefab, `XRParticipantRuntime`, networking conventions |
| Desktop Package | Not yet scoped |

---

### Ignored ⚠️ — XROrigin Inside the Participant Prefab

The doc suggests including `XROrigin` + `CameraOffset` inside the XR Participant Prefab.

**We reject this for Phase 2.** Reason:
- XROrigin contains the Camera and must persist across scene loads
- The networked prefab is spawned/destroyed per player connection
- App teams own their scene's XROrigin, we own the networked rig
- Our `XRTrackingBridge` bridges the scene's XROrigin → our networked rig

**Update (Step 2):** We ARE adding `XROrigin` to `XRPresenceTestScene` (our dev scene) for tracking source. App teams still own their own XROrigin in production scenes. The separation remains: **XROrigin in scene (app-owned) ≠ XRRuntimeParticipantRoot prefab (us-owned).**

---

## 2. Participant Hierarchy

### Adopted ✅ — Composition Over Inheritance

The doc advocates:

```text
ParticipantBase +
XRPresenceModule /
XRTrackingModule /
XRInteractionModule
```

**Our mapping:**
| Doc's Component | Our Implementation |
|-----------------|-------------------|
| `ParticipantBase` | `RuntimeEntity` (NetID, ownership, lifecycle state machine) |
| `XRPresenceModule` | `RuntimeParticipant` (head/hand anchors, session registration) |
| `XRTrackingModule` | `XRParticipantRuntime` (local/remote separation, proxy toggling) |
| `XRTrackingBridge` | **Step 2 — to build** (copies XR tracking → networked transforms) |
| `XRInteractionModule` | Nareen's pipeline (grabbable, ownership transfer) |

---

## 3. Core Participant (ParticipantBase) — Already Implemented

### Responsibilities Already Covered

| Doc's Responsibility | Our Implementation | Status |
|---------------------|-------------------|--------|
| Network identity | `NetworkIdentity` on prefab root | ✅ Done |
| Ownership tracking | `RuntimeEntity.ownerNetId` SyncVar | ✅ Done |
| Authority state | `RuntimeEntity.OnStartAuthority()` / `OnStopAuthority()` | ✅ Done |
| Spawn lifecycle | `RuntimeEntity` state machine (Created→Registered→Initialized→Active→CleaningUp→Destroyed) | ✅ Done |
| Despawn lifecycle | `RuntimeSpawnService.DespawnEntity()` → `Cleanup()` | ✅ Done |
| Session membership | `RuntimeParticipant.OnStartServer()` registers with `RuntimeSessionManager` | ✅ Done |
| Participant registration | `RuntimeSessionManager.RegisterParticipant()` | ✅ Done |
| Runtime lookup | `RuntimeEntityRegistry` | ✅ Done |
| Connected state | `RuntimeParticipantInfo.IsConnected` | ✅ Done |
| Disconnected state | `RuntimeParticipantInfo.MarkDisconnected()` | ✅ Done |

### NOT Yet Implemented (Future Phases)

| Doc's Responsibility | Planned Phase |
|---------------------|---------------|
| Telemetry / ping tracking / network health | Phase 3 |
| Voice state | Future |
| User metadata | Future |
| Participant capabilities | Future |

---

### Ignored ⚠️ — Removing XR Fields from Core Participant

The doc argues `ParticipantBase` should NOT have XR-specific fields (HeadRoot, LeftHandRoot, RightHandRoot). Our `RuntimeParticipant` currently has them.

**We keep them for now.** Moving them to an XR-only subclass is a valid refactoring but is not blocking Phase 2. This can be done when the Desktop Participant variant is introduced.

---

## 4. XR Participant Prefab — Implemented in Step 1

### What the Doc Says vs What We Have

| Doc's Component | Our Prefab | Status |
|----------------|------------|--------|
| HeadRoot | `HeadRoot` child with `NetworkTransformReliable` | ✅ Done |
| LeftHandRoot | `LeftHandRoot` child with `NetworkTransformReliable` | ✅ Done |
| RightHandRoot | `RightHandRoot` child with `NetworkTransformReliable` | ✅ Done |
| Head Proxy | `HeadProxy` (sphere, disabled by default) | ✅ Done |
| Hand Proxies | `LeftHandProxy`, `RightHandProxy` (sphere, disabled by default) | ✅ Done |
| XRTrackingBridge | **Not yet** — Step 2 | 🔜 To build |
| `SupportsHands` / `SupportsControllers` capability flags | Not yet — future concern | 📋 Future |

### Expected Behavior per Doc — Already Valid

```
Player joins → Head appears → Hands appear → Tracking synchronizes → Remote visible
```

This is exactly our pipeline. ✅

---

## 5. Framework Boundaries — Cleanly Defined

| Layer | Owns | Our Implementation |
|-------|------|-------------------|
| **CXR Core** | Participant lifecycle, session lifecycle, presence state, authority rules, room membership, runtime registration | `RuntimeEntity`, `RuntimeSessionManager`, `RuntimeEntityRegistry`, `RuntimeSpawnService` |
| **XR Package** | XR tracking integration, head/hand/controller tracking, XR rig integration, XR presence visualization | `XRRuntimeParticipantRoot` prefab, `XRParticipantRuntime`, `XRTrackingBridge` (Step 2), proxy visuals |
| **Desktop Package** | Desktop movement, camera, character representation | Future |
| **Application** | Gameplay, interactions, UI, avatar visuals, game rules, scene content, XROrigin | App teams own this |

---

## 6. What We're Implementing Next (Steps 2-7)

### Step 2 — XRTrackingBridge (Validated by Doc ✅)

The doc explicitly names `XRTrackingBridge` as an XR Package component. This validates our plan.

**What it does:**
1. Lives as a **standalone scene singleton** (not on XROrigin)
2. Finds `XROrigin` in the scene via `FindAnyObjectByType`
3. References the local player's `XRParticipantRuntime` (found via `NetworkClient.localPlayer`)
4. In `LateUpdate`, copies tracked poses from XROrigin's Camera/Controllers → networked rig's transforms
5. Only runs on the local client
6. Includes **keyboard/mouse fallback** for testing without XR hardware

**Tracking approach: Manual polling (not TrackedPoseDriver).**
- We poll XROrigin's Camera transform and Controller transforms directly in `LateUpdate`
- SDK components (`TrackedPoseDriver` on XROrigin children) handle the actual device tracking
- Bridge only **copies**, never tracks — clean separation
- No TrackedPoseDriver on the prefab (avoids authority enable/disable complexity)

**What it does NOT do** (handled by others):
- Track XR devices → `TrackedPoseDriver` on XROrigin children
- Interpolate for remote → `NetworkTransformReliable`
- Handle coordinate spaces → `XROrigin`

### Step 3 — Validate Local vs Remote Separation ✅ Already Done

`XRParticipantRuntime` handles:
- `OnStartLocalPlayer()` → proxies hidden
- `OnStartClient()` non-local → proxies shown
- No Camera in prefab (XROrigin is app-owned)

### Step 4 — Spawn/Despawn Lifecycle ✅ Already Wired

- Mirror's `OnServerAddPlayer` spawns our prefab (playerPrefab already set in XRNetworkManager)
- `RuntimeParticipant.OnStartServer()` registers with session manager
- `RuntimeSessionManager` handles disconnect cleanup

### Step 5 — Visual Proxies ✅ Already in Prefab

HeadProxy (sphere), LeftHandProxy (sphere), RightHandProxy (sphere), Capsule body proxy.

### Step 6 — Stress Testing

Validate: multi-client join/leave, transform sync, reconnects.

### Step 7 — Standardization & Docs

Logging convention `[XR_PRESENCE]`, prefab standards, conventions doc.

---

## 7. Long-Term Vision (From Doc — Not Phase 2)

The doc envisions CXR supporting:

| Variant | Status |
|---------|--------|
| `XRParticipantPrefab` | ✅ Phase 2 |
| `DesktopParticipantPrefab` | 📋 Future |
| `MRParticipantPrefab` | 📋 Phase 6 |
| `SpectatorParticipantPrefab` | 📋 Future |
| `VehicleParticipantPrefab` | 📋 Future |
| Multiple networking stacks | 📋 Future (we're Mirror-only for now) |

---

## 8. Design Decisions Log

| Decision | Chosen Approach | Rationale |
|----------|----------------|-----------|
| XROrigin in prefab or scene? | **Scene** (app-owned) | Camera must persist; networked rig is ephemeral |
| Base participant XR-aware? | **No** — stripped to `RuntimeParticipant` | XR fields moved to `XRRuntimeParticipant` subclass (completed Step 1.5) |
| Tracking: manual or TrackedPoseDriver? | **Manual polling Bridge** | SDK tracks via TrackedPoseDriver on XROrigin children; Bridge just copies. No prefab pollution, no authority enable/disable complexity. |
| Bridge or direct NetworkTransform on XROrigin? | **Bridge pattern** | Clean separation of concerns |
| Testing fallback | **Keyboard/mouse in Bridge** | WASD + mouse look for testing without XR headset |
| Single networking stack or adapters? | **Mirror-only** for Phase 2 | Adapters add complexity without current need |
| XR packages | **OpenXR 1.12.1**, **XR Interaction Toolkit 2.5.4**, **XR Management 4.5.0** | Industry standard for Unity 2022.3 LTS. OpenXR for runtime compatibility; XR IT for XROrigin + TrackedPoseDriver; Management for loader lifecycle. |
