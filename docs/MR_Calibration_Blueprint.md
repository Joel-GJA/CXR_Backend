# MR Calibration Blueprint

The MR path uses marker-based shared-origin alignment. ArUco or AprilTag detection can feed marker poses into `MRCalibrationManager`; cloud anchors and shared SLAM are intentionally out of scope for the current LAN-first deployment.

## Runtime Components

- `MRCalibrationManager`: owns calibration state, active marker id, shared origin transform, and calibration events.
- `SharedOrigin`: a transform created or assigned by the manager. MR scenes can parent synced content under this transform or use it as an offset reference.
- Marker detector: app-specific component that detects ArUco/AprilTag markers and calls `ApplyMarkerPose`.

## Flow

1. Call `BeginCalibration(markerId)`.
2. Detect the marker with camera/device-specific code.
3. Convert the detected marker into an `MRMarkerPose`.
4. Call `ApplyMarkerPose(markerPose)`.
5. On success, `SharedOrigin` is positioned and `CalibrationCompleted` is emitted.

## Future Scene Work

Create an MR validation scene with a calibration zone, a visible marker id, two-client shared-origin comparison, and one networked interactable placed after calibration.
