using NUnit.Framework;
using UnityEngine;

public sealed class MRCalibrationManagerTests
{
    [Test]
    public void ApplyMarkerPose_CompletesCalibrationAndSetsSharedOrigin()
    {
        GameObject root = new GameObject("MR Calibration Test");

        try
        {
            MRCalibrationManager manager =
                root.AddComponent<MRCalibrationManager>();

            manager.BeginCalibration("marker-a");

            bool applied = manager.ApplyMarkerPose(
                new MRMarkerPose(
                    "marker-a",
                    new Vector3(1f, 2f, 3f),
                    Quaternion.Euler(0f, 45f, 0f),
                    true));

            Assert.IsTrue(applied);
            Assert.AreEqual(MRCalibrationState.Calibrated, manager.State);
            Assert.IsNotNull(manager.SharedOrigin);
            Assert.AreEqual(new Vector3(1f, 2f, 3f), manager.SharedOrigin.position);
        }
        finally
        {
            Object.DestroyImmediate(root);
        }
    }

    [Test]
    public void ApplyMarkerPose_RejectsWrongMarker()
    {
        GameObject root = new GameObject("MR Calibration Reject Test");

        try
        {
            MRCalibrationManager manager =
                root.AddComponent<MRCalibrationManager>();

            manager.BeginCalibration("marker-a");

            bool applied = manager.ApplyMarkerPose(
                new MRMarkerPose(
                    "marker-b",
                    Vector3.zero,
                    Quaternion.identity,
                    true));

            Assert.IsFalse(applied);
            Assert.AreEqual(MRCalibrationState.Failed, manager.State);
        }
        finally
        {
            Object.DestroyImmediate(root);
        }
    }
}
