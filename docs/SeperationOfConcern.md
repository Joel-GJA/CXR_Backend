# CXR Participant Architecture Proposal

## Goal

CXR should support both XR and non-XR multiplayer applications while providing opinionated, production-ready participant prefabs that cover the majority of common multiplayer requirements.

The objective is not to create a completely generic abstraction layer that forces developers to assemble everything manually. Instead, CXR should provide reusable prefabs that can be dropped into a project and work immediately.

---

# Design Philosophy

CXR should be split into:

1. **Core Runtime Layer**
2. **XR Package**
3. **Desktop Package**

The Core Runtime Layer remains platform-agnostic.

The XR and Desktop packages provide opinionated implementations for their respective application types.

---

# High-Level Architecture

```text
CXR Core
│
├── ParticipantBase
├── RuntimeSessionManager
├── Session Registry Integration
├── Presence System
├── Telemetry System
└── Networking Adapters

CXR XR Package
│
├── XRParticipantPrefab
├── XRTrackingBridge
├── XRPresenceModule
└── XRInteraction Hooks

CXR Desktop Package
│
├── DesktopParticipantPrefab
├── DesktopMovementModule
└── DesktopCameraModule
```

---

# Participant Hierarchy

Rather than making XR concepts part of the core participant, CXR should provide specialized participant variants.

```text
ParticipantBase
├── XRParticipantPrefab
└── DesktopParticipantPrefab
```

However, internally these prefabs should be assembled through composition rather than deep inheritance.

---

# Core Participant (ParticipantBase)

The base participant should only contain functionality that is useful to every multiplayer application.

It should not contain XR-specific concepts such as heads, hands, controllers, or XR rigs.

## Responsibilities

### Networking

- Network identity
- Ownership tracking
- Authority state
- Spawn lifecycle
- Despawn lifecycle

### Session Integration

- Session membership
- Participant registration
- Runtime lookup
- Room membership

### Presence

- Connected state
- Disconnected state
- Reconnecting state

### Telemetry

- Connection status
- Ping tracking
- Network health metrics

### Future Extensions

- Voice state
- User metadata
- Participant capabilities

---

# XR Participant Prefab

The XR Participant Prefab should provide everything that nearly every multiplayer XR application requires.

The goal is that developers can drag the prefab into a project and immediately obtain synchronized XR presence.

## Included Components

### XR Presence

```text
HeadRoot
LeftHandRoot
RightHandRoot
```

### XR Rig Integration

```text
XROrigin
CameraOffset
```

### XR Tracking

```text
XRTrackingBridge
```

### XR Presence Visualization

```text
Head Proxy
Hand Proxies
```

### XR Capability Flags

```text
SupportsHands
SupportsControllers
SupportsEyeTracking
SupportsFaceTracking
```

## Expected Behavior

After spawning:

```text
Player joins
Head appears
Hands appear
Tracking synchronizes
Remote participants become visible
```

with minimal developer setup.

---

# Desktop Participant Prefab

The Desktop Participant Prefab should provide common functionality required by non-XR multiplayer applications.

## Included Components

### Character Root

```text
CharacterRoot
```

### Camera Root

```text
CameraRoot
```

### Character Movement Hooks

```text
Move
Jump
Look
```

### Character Visualization

Optional placeholder visuals for:

```text
First Person
Third Person
```

## Expected Behavior

After spawning:

```text
Player joins
Character appears
Movement synchronizes
Remote participants become visible
```

with minimal developer setup.

---

# Composition-Based Architecture

Avoid deep inheritance chains.

Instead, build participant variants using reusable modules.

## XR Participant Assembly

```text
ParticipantBase
    +
XRPresenceModule
    +
XRTrackingModule
    +
XRInteractionModule
```

Result:

```text
XRParticipantPrefab
```

---

## Desktop Participant Assembly

```text
ParticipantBase
    +
DesktopMovementModule
    +
DesktopCameraModule
```

Result:

```text
DesktopParticipantPrefab
```

---

# Future Participant Variants

This architecture allows additional participant types without modifying the core runtime.

Examples:

```text
MRParticipantPrefab
SpectatorParticipantPrefab
VehicleParticipantPrefab
AIControlledParticipantPrefab
```

Each variant can reuse the same ParticipantBase while adding specialized functionality.

---

# Framework Boundaries

## CXR Core Owns

```text
Participant lifecycle
Session lifecycle
Presence state
Authority rules
Room membership
Telemetry
Networking abstractions
Runtime registration
```

---

## XR Package Owns

```text
XR tracking integration
Head tracking
Hand tracking
Controller tracking
XR rig integration
XR presence visualization
```

---

## Desktop Package Owns

```text
Desktop movement
Desktop camera systems
Character representation
Desktop-specific input integration
```

---

## Application Owns

```text
Gameplay systems
Interactions
UI
Avatar visuals
Game rules
Scene content
Custom mechanics
```

---

# SDK Separation Strategy

To support multiple networking stacks and both XR and non-XR applications, CXR should maintain clear separation between:

## Networking Layer

Examples:

```text
Mirror
FishNet
Unity Netcode
Photon
```

Responsibilities:

```text
Replication
RPCs
Ownership
Serialization
Spawn/Despawn
```

---

## XR Layer

Examples:

```text
OpenXR
Meta XR
XR Interaction Toolkit
XR Hands
```

Responsibilities:

```text
Tracking
Controllers
Hands
Eye Tracking
Face Tracking
```

---

## CXR Layer

Responsibilities:

```text
Participant lifecycle
Presence management
Session management
Runtime coordination
Telemetry
```

CXR should orchestrate these systems without being tightly coupled to a specific networking or XR SDK.

---

# Long-Term Vision

CXR should evolve into a reusable real-time presence framework capable of supporting:

- Multiplayer XR applications
- Desktop multiplayer applications
- Mixed Reality applications
- Spectator experiences
- Simulation environments

while still providing opinionated participant prefabs that offer a plug-and-play developer experience.