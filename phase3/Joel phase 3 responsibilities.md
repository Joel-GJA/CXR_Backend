# Joel — Phase 3 Responsibilities: MR Foundation

## Track A: MR Foundation

J should own the complete **Mixed Reality foundation pipeline** — from marker detection through shared-origin alignment to calibration workflow.

This builds directly on J's Phase 2 XR rig synchronization work. The XR rig provides head/hand transforms in VR; MR calibration extends that to shared spatial coordinates in passthrough/MR mode.

---

## J's Final Deliverable

By the end of Phase 3:
- two colocated MR headsets detect the same physical marker,
- align to a shared coordinate origin,
- see synchronized objects (from N's interactable system) at the same real-world position,
- and a calibration workflow guides users through the process.

---

## Specifically What J Should Build

### 1. Marker Detection Integration

J should integrate marker-based tracking using **ArUco** or **AprilTag**.

Responsibilities:
- marker detection at runtime,
- marker pose estimation,
- marker ID reading and validation,
- detection result ingestion into the calibration pipeline.

J does NOT build:
- SLAM systems,
- cloud anchor integrations,
- environment reconstruction.

### 2. MRCalibrationManager Runtime Component

J should create a singleton `MRCalibrationManager` component responsible for:

- calibration state machine (Idle → Detecting → Aligned → Tracking → Lost),
- marker detection result ingestion,
- shared-origin transform computation,
- calibration completion events,
- calibration timeout and retry logic.

The calibration manager is the single source of truth for MR alignment state.

### 3. SharedOrigin Transform

J should define a `SharedOrigin` transform that XR presence and interactables can optionally use when running MR scenes.

Responsibilities:
- transforms local tracking space into shared marker-anchored space,
- provides conversion utilities (local space ↔ shared space),
- is consumed by J's XR rig and N's interactables when MR mode is active,
- emits `CalibrationStarted` / `CalibrationCompleted` RuntimeEvents.

### 4. MR Validation Scene

J should create a dedicated MR validation scene containing:
- calibration zone with a physical marker reference,
- synchronized objects placed at known shared-origin positions,
- diagnostics overlay showing calibration state and transform offsets.

### 5. MR Calibration Documentation

J should document:
- marker placement requirements,
- calibration workflow steps,
- shared-origin integration guide for app teams,
- troubleshooting common calibration failures.

---

## What J Should NOT Touch

| Area | Owner |
|------|-------|
| RuntimeEvent contract design | H (J reviews) |
| Telemetry emitter & Prometheus | H |
| Database schemas & persistence | N |
| Host Manager & dashboard UI | A |
| Interaction/ownership internals | N |
| Validation scene for non-MR testing | H |

---

## Practical Implementation Sequence

### STEP 1
Integrate marker detection (ArUco/ AprilTag) into the Unity project as a standalone test.

### STEP 2
Create `MRCalibrationManager` with state machine and event hooks.

### STEP 3
Define `SharedOrigin` transform and test coordinate conversion.

### STEP 4
Wire XR rig and interactables to optionally use `SharedOrigin`.

### STEP 5
Build MR validation scene with calibration flow and diagnostics.

### STEP 6
Stress-test: marker detection under varied lighting, two-client alignment, object placement consistency.

### STEP 7
Write MR calibration documentation and integration guide.

---

## Final Ownership Boundary

```
Physical Marker Detection
        ↓
Pose Estimation & ID Validation
        ↓
MRCalibrationManager (state machine)
        ↓
SharedOrigin Transform Computation
        ↓
XR Rig Alignment + Interactable Placement
```

That subsystem is:
- vertically sliced,
- self-contained,
- low-dependency,
- architecturally clean.
