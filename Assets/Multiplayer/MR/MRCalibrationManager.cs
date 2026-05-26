using System;
using UnityEngine;

[DisallowMultipleComponent]
public sealed class MRCalibrationManager : MonoBehaviour
{
    [SerializeField]
    private Transform sharedOrigin;

    [SerializeField]
    private string activeMarkerId = "default";

    [SerializeField]
    private MRCalibrationState state = MRCalibrationState.Idle;

    public Transform SharedOrigin => sharedOrigin;
    public string ActiveMarkerId => activeMarkerId;
    public MRCalibrationState State => state;
    public bool IsCalibrated => state == MRCalibrationState.Calibrated;

    public event Action<MRCalibrationState, MRCalibrationState> StateChanged;
    public event Action<Transform> CalibrationCompleted;

    private void Awake()
    {
        EnsureSharedOrigin();
    }

    public void BeginCalibration(string markerId)
    {
        activeMarkerId = string.IsNullOrWhiteSpace(markerId)
            ? "default"
            : markerId;

        TransitionTo(MRCalibrationState.DetectingMarker);

        RuntimeEventEmitter.Emit(
            RuntimeEventType.CalibrationStarted,
            nameof(MRCalibrationManager),
            $"Calibration started for marker '{activeMarkerId}'.",
            metadataJson: BuildMarkerMetadata(activeMarkerId));
    }

    public bool ApplyMarkerPose(MRMarkerPose markerPose)
    {
        if (!markerPose.isValid)
        {
            FailCalibration("Marker pose was invalid.");
            return false;
        }

        if (!string.IsNullOrWhiteSpace(activeMarkerId) &&
            !string.Equals(activeMarkerId, markerPose.markerId, StringComparison.Ordinal))
        {
            FailCalibration(
                $"Expected marker '{activeMarkerId}' but received '{markerPose.markerId}'.");
            return false;
        }

        EnsureSharedOrigin();
        sharedOrigin.SetPositionAndRotation(markerPose.position, markerPose.rotation);
        CompleteCalibration();
        return true;
    }

    public void ResetCalibration()
    {
        TransitionTo(MRCalibrationState.Idle);
    }

    public void FailCalibration(string reason)
    {
        TransitionTo(MRCalibrationState.Failed);
        Debug.LogWarning($"[MR] Calibration failed: {reason}");
    }

    private void CompleteCalibration()
    {
        TransitionTo(MRCalibrationState.Calibrated);
        CalibrationCompleted?.Invoke(sharedOrigin);

        RuntimeEventEmitter.Emit(
            RuntimeEventType.CalibrationCompleted,
            nameof(MRCalibrationManager),
            $"Calibration completed for marker '{activeMarkerId}'.",
            metadataJson: BuildMarkerMetadata(activeMarkerId));
    }

    private void EnsureSharedOrigin()
    {
        if (sharedOrigin != null)
        {
            return;
        }

        GameObject origin = new GameObject("SharedOrigin");
        origin.transform.SetParent(transform, false);
        sharedOrigin = origin.transform;
    }

    private void TransitionTo(MRCalibrationState nextState)
    {
        if (state == nextState)
        {
            return;
        }

        MRCalibrationState previousState = state;
        state = nextState;
        StateChanged?.Invoke(previousState, state);
    }

    private static string BuildMarkerMetadata(string markerId)
    {
        return "{\"markerId\":\"" + (markerId ?? string.Empty) + "\"}";
    }
}
