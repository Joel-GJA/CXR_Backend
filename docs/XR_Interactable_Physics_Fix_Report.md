# XR Interactable Physics Fix Report

## Problem Summary

The XR multiplayer interactable pipeline originally had three major issues:

1. remote release poses could be validated incorrectly, especially for ray grabs and low-to-ground releases
2. clients could momentarily "ghost grab" objects already held by another player
3. passive contact felt asymmetric, where the host could naturally push objects but remote players could not

These issues were especially visible in `XRPresenceTestScene` when testing grab/release, stacking, and Quest controller interaction.

## What Was Implemented

### Release And Stabilization

- release now sends position, rotation, linear velocity, and angular velocity
- the server validates the release pose before physics resumes
- the server applies conservative post-release stabilization for a short period
- idle non-owning clients keep rigidbodies kinematic and render server-synced motion

### Grab Ownership Gating

- `XRInteractableBridge` now blocks local XR selection when another player is already holding the object
- if a local XR select race occurs before authority resolves, the local selection is canceled

This removed the "I can move it locally but it snaps back to the real holder" behavior.

### Passive Hand And Body Pushing

- `XRParticipantRuntime` creates server-only hand and body contact proxies
- hand proxies use sphere triggers that follow replicated controller poses
- the body proxy uses a capsule trigger that follows the participant root
- grabbed interactables are excluded from passive push response
- remote participants use stronger push multipliers than the host path

### Keyboard Fallback Reliability

- keyboard fallback now resolves XR rigs using both `Camera Offset` and `CameraOffset`
- body contact during keyboard fallback also uses proactive overlap checks so passive pushing works more reliably without relying only on trigger timing

## Current Outcome

The interaction model is now:

- `grab`: explicit authority transfer
- `release`: server-validated physics handoff
- `passive push`: server-only hand/body contact proxies

This is a reusable infrastructure feature, not a one-off cube fix. It is designed to support future props such as simulation tools, weapons, anatomy models, and irregular compound-collider objects.

## Known Limits

- passive contact is still an approximation of fully physical networked avatars
- host and remote feel may still need tuning for specific props
- remote rolling/torque behavior is intentionally conservative after recent rollback
- final feel still depends on collider quality, Rigidbody mass, and scene collision setup

## Source Files

- `Assets/Multiplayer/Core/Network/RuntimeInteractable.cs`
- `Assets/Multiplayer/XR/XRInteractableBridge.cs`
- `Assets/Multiplayer/Core/Runtime/XRParticipantRuntime.cs`
- `Assets/Multiplayer/Core/Runtime/XRHandPhysicsContactProxy.cs`
- `Assets/Multiplayer/Core/Runtime/XRBodyPhysicsContactProxy.cs`
- `Assets/Multiplayer/XR/XRTrackingBridge.cs`
