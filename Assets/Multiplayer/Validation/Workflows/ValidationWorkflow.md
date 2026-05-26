# Validation Workflows

This document defines structured, reproducible test workflows for every multiplayer feature in the project. Each workflow follows a consistent format: prerequisites, step-by-step procedure, expected results, and observation logging.

---

## 1. Connection Validation

### 1.1 Host Launch

| Field | Value |
|-------|-------|
| **Scene** | `ValidationReferenceEnvironment` |
| **Prerequisites** | Scene loaded, no active network connections |
| **Key Bindings** | F1 (Debug GUI), F2 (Validation Panel) |

**Procedure:**
1. Open Validation Panel (F2) → Connection tab
2. Click "1. Start Host"
3. Verify Connection Status Bar shows `HostActive`
4. Verify Session Status shows `WaitingForParticipants` or `SessionActive`
5. Verify clients count shows at least 1 (the host)

**Expected Result:**
- Host starts without errors
- NetworkManager transitions to active state
- Session manager begins server session

### 1.2 Client Connection

| Field | Value |
|-------|-------|
| **Prerequisites** | Host running on same machine or reachable address |
| **Network Address** | Default: `localhost` |

**Procedure:**
1. With host active, click "3. Connect Client"
2. Verify Connection Status Bar shows `ClientConnected`
3. Verify participants count increments
4. Verify both host and client show matching participant counts

**Expected Result:**
- Client connects successfully
- Both sides reflect the new participant
- No connection timeout or rejection errors

### 1.3 Disconnect & Reconnect

| Field | Value |
|-------|-------|
| **Prerequisites** | Host + at least 1 client connected |

**Procedure:**
1. Click "4. Disconnect" on client
2. Verify status returns to `Offline` or `ServerActive` (if host)
3. Click "3. Connect Client" to reconnect
4. Verify reconnection succeeds

**Expected Result:**
- Clean disconnect with no orphaned state
- Full reconnection capability
- No duplicate participants after reconnect

---

## 2. XR Presence Validation

### 2.1 Participant Registration

| Field | Value |
|-------|-------|
| **Prerequisites** | Host + at least 1 client connected |

**Procedure:**
1. Navigate to Validation Panel → XR Presence tab
2. Observe Local Player section shows correct NetID and Connection ID
3. On the host, observe Remote Participants list
4. Verify participant name, NetID, and tracking status are visible

**Expected Result:**
- Local player identity is correct
- Remote participants appear on all connected peers
- Participant metadata (name, NetID) is accurate

### 2.2 Spawn Point Validation

| Field | Value |
|-------|-------|
| **Prerequisites** | Host active |

**Procedure:**
1. Click "Respawn Spawn Point Visuals"
2. Observe 4 green cylinder markers at z=4 in the scene
3. Start a client and verify both host and client see the markers
4. Note: Spawn point visuals are local-only (primitive cylinders)

**Expected Result:**
- Spawn markers visible at expected positions
- Markers provide reference for player spawn positions

---

## 3. Ownership Validation

### 3.1 Cube Grab (Single Client)

| Field | Value |
|-------|-------|
| **Prerequisites** | Host + at least 1 client connected, cubes spawned |
| **Key Bindings** | P (Grab), R (Release) |

**Procedure:**
1. Navigate to Validation Panel → Ownership tab
2. Click "Spawn Validation Cubes" (host only, requires server active)
3. Walk a player character near a cube
4. Press **P** to grab
5. Observe Ownership tab — cube state changes from `Idle` to `Grabbed`
6. Verify `Held by` shows the grabbing player's NetID
7. Move the player and verify the cube follows smoothly (no jitter/glitching)

**Expected Result:**
- Cube transitions to `Grabbed` state
- Owner NetID assigned correctly
- Cube follows holder without physics glitching
- Gravity disabled while held

### 3.2 Cube Release

| Field | Value |
|-------|-------|
| **Prerequisites** | Cube currently grabbed by a player |

**Procedure:**
1. Press **R** to release the cube
2. Observe Ownership tab — cube state returns to `Idle`
3. Verify `Held by` shows none
4. Verify cube falls with gravity (non-kinematic restored)

**Expected Result:**
- Clean state transition back to `Idle`
- Gravity re-enabled
- Cube responds to physics normally
- Authority released cleanly

### 3.3 Ownership Conflict (Two Clients)

| Field | Value |
|-------|-------|
| **Prerequisites** | Host + 2 clients connected, cubes spawned |

**Procedure:**
1. Client A presses **P** near a cube to grab it
2. Client B presses **P** near the same cube
3. Verify Client B's grab is rejected
4. Verify cube remains owned by Client A

**Expected Result:**
- Only the first grabber gains ownership
- Second grab attempt is rejected gracefully
- No ownership race condition or desync

---

## 4. Diagnostics Validation

### 4.1 Real-time Metrics

| Field | Value |
|-------|-------|
| **Prerequisites** | Host + at least 1 client connected |

**Procedure:**
1. Navigate to Validation Panel → Diagnostics tab
2. Observe metrics panel:
   - Registered Entities count
   - Connected Clients count
   - Network Ping (when client is active)
3. Observe Session section showing current state and participant count

**Expected Result:**
- Metrics update in real-time (0.5s refresh)
- Entity count matches expected spawned objects
- Ping values are reasonable (< 100ms for local)
- Session state matches connection state

### 4.2 Event Log Validation

| Field | Value |
|-------|-------|
| **Prerequisites** | Any active session |

**Procedure:**
1. Perform a sequence of actions (host start, client connect, grab cube, etc.)
2. Observe Event Log in Diagnostics tab
3. Verify each action produces a timestamped log entry
4. Click "Clear Log" to reset

**Expected Result:**
- Every lifecycle event is logged
- Entries are in chronological order
- Timestamps are accurate
- Log truncation works (bounded to maxLogLines)

---

## 5. Lifecycle Stress Tests

### 5.1 Join/Leave Cycle

| Field | Value |
|-------|-------|
| **Prerequisites** | Host running |

**Procedure:**
1. Connect client → wait 2 seconds → disconnect
2. Repeat 10 times
3. After each cycle, verify:
   - No orphaned participants
   - Session state remains correct
   - Event log shows clean connect/disconnect pairs

**Expected Result:**
- All 10 cycles complete without degradation
- No memory leaks or hanging connections
- Consistent participant count between cycles

### 5.2 Spawn Flood

| Field | Value |
|-------|-------|
| **Prerequisites** | Host + at least 1 client connected |

**Procedure:**
1. Spawn validation cubes (up to 3)
2. Rapidly grab and release cubes multiple times
3. Verify entity registry remains consistent
4. Verify no orphaned network identities

**Expected Result:**
- All spawns complete within normal time
- Registry count matches expected
- No duplicate NetIDs or registration errors

---

## 6. Bug Reproduction Template

When filing a bug report, use the following format:

```
## Environment
- Build Version: [commit hash or build number]
- Host/Client Count: [number]
- Scene: [scene name]

## Steps to Reproduce
1. [step]
2. [step]
3. [step]

## Expected Result
[what should happen]

## Actual Result
[what actually happens]

## Attachments
- Player.log / Editor.log
- Screenshot / Video
- Validation Event Log export
```

---

## Key Bindings Reference

| Key | Action |
|-----|--------|
| **F1** | Toggle XR Multiplayer Debug GUI |
| **F2** | Toggle Validation Scene Controller |
| **P** | Grab / Pick up interactable object |
| **R** | Release interactable object |
| **WASD** | Move player character |
| **Space** | Jump |
