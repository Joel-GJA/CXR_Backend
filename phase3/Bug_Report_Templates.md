# Phase 3 — Bug Reproduction Templates

Standard templates for reporting defects across the CXR subsystems. Copy the
relevant block into a new issue, fill every field, and attach logs. A report
without **exact steps** and **logs** is not actionable.

General rules:
- One bug per report.
- Always include build/commit hash, platform, and how many clients/headsets.
- Prefer a short screen recording for sync/calibration issues.
- Pull logs from the panel **Live Logs** page (filter by service) and the
  per-room `*.stdout.log` / `*.stderr.log` files.

---

## 1. Synchronization Desync

```
Title: [SYNC] <short summary>

Environment
- Build / commit: 
- Platform(s): (Quest 3 / PCVR / Editor)
- Clients involved: (e.g. 2 headsets + 1 editor host)
- Room / scene: 
- Registry URL: 

Steps to Reproduce
1. 
2. 
3. 

Expected
- (e.g. remote head/controller transforms track within ~100 ms)

Actual
- (e.g. remote avatar frozen / jittering / teleporting)

Frequency
- (always / intermittent — X out of Y attempts)

Evidence
- Video: 
- Host log (room stdout): 
- Client log: 
- RuntimeEvents around the incident (PlayerJoined/Left timestamps): 

Notes
- 
```

---

## 2. Ownership Failure

```
Title: [OWNERSHIP] <short summary>

Environment
- Build / commit: 
- Clients involved: 
- Interactable object(s): 

Steps to Reproduce
1. 
2. 
3. 

Expected
- (e.g. OwnershipAcquired emitted, object follows grabbing player, others blocked)

Actual
- (e.g. two players grab simultaneously / object snaps back / no transfer event)

RuntimeEvents observed
- OwnershipAcquired: 
- OwnershipReleased: 
- OwnershipTransferred: 

Evidence
- Video: 
- Logs (both clients): 

Notes
- 
```

---

## 3. Calibration Failure (MR)

```
Title: [CALIBRATION] <short summary>

Environment
- Build / commit: 
- Headsets involved: 
- Marker type / size: (ArUco / AprilTag, mm)
- Lighting conditions: 

Steps to Reproduce
1. 
2. 
3. 

Expected
- CalibrationStarted → CalibrationCompleted(success=true), shared origin aligned
  across headsets within tolerance.

Actual
- (e.g. CalibrationCompleted success=false / origins diverge by N cm / no marker detected)

Measured offset between headsets
- position: ___ cm    rotation: ___ deg

RuntimeEvents observed
- CalibrationStarted: 
- CalibrationCompleted: 

Evidence
- Video showing both headset views: 
- Logs: 

Notes
- 
```

---

## 4. Host Manager Process Crash

```
Title: [HOSTMGR] <short summary>

Environment
- Build / commit: 
- Panel host (OS / Node version): 
- Service template: (room-registry / unity-room)
- Number of rooms running at crash: 

Steps to Reproduce
1. 
2. 
3. 

Expected
- (e.g. room starts and stays running / clean stop / restart succeeds)

Actual
- (e.g. process exits with code N / crash loop / port not released / log gap)

Process detail
- serviceId: 
- exit code / signal: 
- restartCount at failure: 
- did other rooms stay isolated? (yes/no)

Evidence
- Panel Live Logs (filtered to service): 
- Per-service stderr log file: 
- ServerStarted / ServerStopped RuntimeEvents: 

Notes
- 
```
